from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # IMAP
    imap_host: str
    imap_port: int = 993
    imap_user: str
    imap_pass: str

    # SMTP
    smtp_host: str
    smtp_port: int = 465
    smtp_user: str
    smtp_pass: str

    # OpenAI
    openai_api_key: str

    # Supabase
    supabase_url: str
    supabase_service_key: str

    @property
    def supabase_rpc_url(self) -> str:
        return f"{self.supabase_url}/rest/v1/rpc/match_faqs_json"

    @property
    def supabase_rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"


settings = Settings()
