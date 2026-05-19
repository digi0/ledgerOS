"""Gmail connector — to be implemented once OAuth credentials are configured.

Planned surface:
    - build_oauth_url(state) -> str
    - exchange_code(code) -> credentials dict
    - list_new_messages(account) -> list[ProviderMessage]
    - fetch_message(account, message_id) -> raw payload + attachments
"""
