import argparse
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from app.commerce.batching import LEGACY_PIPELINES, PIPELINE, SINK_ACTION
from app.commerce.models import BATCH_CLASSIFICATION_PROMPT, BatchMember, validate_batch
from app.config import Settings
from app.setup_database import configure_model


def setup(settings: Settings) -> None:
    if not settings.database_conninfo:
        raise ValueError("Database connection settings are required")
    schema = Path(__file__).resolve().parents[3] / "database" / "commerce.sql"
    model_settings = settings.model_copy(update={
        "azure_openai_endpoint": settings.commerce_model_endpoint or settings.azure_openai_endpoint,
        "model_registry_auth_type": (
            settings.commerce_model_auth_type or settings.model_registry_auth_type
        ),
        "azure_openai_key": settings.commerce_model_key or settings.azure_openai_key,
    })
    with psycopg.connect(settings.database_conninfo, connect_timeout=10) as conn:
        conn.execute("SELECT set_config('statement_timeout',%s,true)", ("90s",))
        existing_runs = conn.execute("SELECT to_regclass('commerce.runs')").fetchone()[0]
        if existing_runs and conn.execute(
            "SELECT 1 FROM commerce.runs WHERE active AND status='running'",
        ).fetchone():
            raise RuntimeError("Pause the commerce simulator and drain analysis before setup")
        conn.execute(schema.read_text(encoding="utf-8"), prepare=False)
        conn.commit()
        conn.execute("SELECT set_config('statement_timeout',%s,true)", ("90s",))
        configure_model(
            conn, model_settings, settings.commerce_classifier_alias,
            settings.commerce_classifier_deployment,
        )
        configure_model(
            conn, model_settings, settings.commerce_briefing_alias,
            settings.commerce_briefing_deployment,
        )
        answer = conn.execute(
            "SELECT azure_ai.generate(%s,%s,%s)",
            ('{"comments":[{"comment_id":"smoke","content":"배송 일정이 언제인가요?"}]}',
             settings.commerce_classifier_alias, BATCH_CLASSIFICATION_PROMPT),
        ).fetchone()
        validate_batch(answer[0] or "", [
            BatchMember(
                comment_id="smoke", content="배송 일정이 언제인가요?",
                source_version=datetime.now(UTC),
            ),
        ])
        existing = conn.execute(
            "SELECT source_config,steps,sink_config,trigger_type FROM ai.pipelines WHERE name=%s",
            (PIPELINE,),
        ).fetchone()
        expected = conn.execute(
            "SELECT ai.table_source(table_name=>'analysis_batches',schema_name=>'commerce',"
            "incremental_column=>'updated_at'),"
            "ARRAY[ai.generate(input=>'content',system_prompt=>%s,max_tokens=>8192,model=>%s)],"
            "ai.table_sink(table_name=>'batch_results',schema_name=>'commerce',"
            "on_conflict=>ARRAY['batch_id'],on_conflict_action=>%s)",
            (BATCH_CLASSIFICATION_PROMPT, settings.commerce_classifier_alias, SINK_ACTION),
        ).fetchone()
        if existing:
            source, steps, sink, trigger = existing
            if (source, steps, sink) != expected or trigger != "on_change":
                raise RuntimeError("Commerce pipeline definition differs; inspect before replacing")
        else:
            conn.execute(
                "SELECT ai.create_pipeline(name=>%s,"
                "source=>ai.table_source(table_name=>'analysis_batches',schema_name=>'commerce',"
                "incremental_column=>'updated_at'),"
                "steps=>ARRAY[ai.generate(input=>'content',system_prompt=>%s,"
                "max_tokens=>8192,model=>%s)],trigger=>'on_change',"
                "sink=>ai.table_sink(table_name=>'batch_results',schema_name=>'commerce',"
                "on_conflict=>ARRAY['batch_id'],on_conflict_action=>%s))",
                (PIPELINE, BATCH_CLASSIFICATION_PROMPT, settings.commerce_classifier_alias, SINK_ACTION),
            )
        for legacy in LEGACY_PIPELINES:
            if conn.execute(
                "SELECT 1 FROM ai.pipelines WHERE name=%s", (legacy,),
            ).fetchone():
                conn.execute("SELECT ai.drop_pipeline(%s)", (legacy,))
        conn.execute("SELECT ai.resume(%s)", (PIPELINE,))
        if existing is None:
            conn.execute("SELECT ai.run(%s)", (PIPELINE,))
    print("Commerce micro-batch pipeline configured (5 seconds / 10 comments); model verified.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up the isolated home-shopping schema/pipeline")
    parser.add_argument("--env-file", help="Additional deployment environment file")
    args = parser.parse_args()
    files = (".env", "backend/.env", args.env_file) if args.env_file else (".env", "backend/.env")
    setup(Settings(_env_file=files))


if __name__ == "__main__":
    main()
