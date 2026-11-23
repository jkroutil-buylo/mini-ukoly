# Mini Úkoly – verze pro telefon

Webová aplikace (lze přidat na plochu Androidu jako ikonu). Pracuje se stejnými soubory jako aplikace pro Windows –
ve složce **Můj disk / MiniUkoly** na Google Disku: `ukoly.json`, `lide.json`, `smazane.json`, návrhy a plány od Clauda.

- Přihlášení účtem Google (Google Identity Services), přístup jen přes Google Drive API.
- Data a rozdělaná práce zůstávají v telefonu i bez signálu, změny se po připojení sloučí (stejná pravidla jako `Sync.ps1`).
- Žádný server, žádná databáze – kód je statický, data jsou jen na Disku uživatele.

Nastavení: `config.js` → `clientId` (OAuth klient typu „Webová aplikace“ s povoleným původem této stránky).
Ukázka bez přihlášení: `…/?demo`.
