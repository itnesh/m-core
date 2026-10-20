# M-CORE

Persönliches Task-, Link- und Chat-Cockpit. Statische Web-App, Firebase Auth und Firestore mit Offline-Cache.

## Sofort testen (ohne Firebase)
`public/index.html` über einen lokalen Webserver öffnen, z.B. `npx serve public`.
Solange `config.js` leer ist, läuft die App im LOCAL-Modus (Daten nur in diesem Browser).

## Live schalten (Firebase)
1. console.firebase.google.com > **Add project** > Name `m-core` (Google Analytics: aus)
2. **Build > Authentication > Get started > Sign-in method > Google** > Enable
3. **Build > Firestore Database > Create database** > Location `eur3 (europe-west)` > **Production mode**
4. **Project settings > General > Your apps > Web (</>)** > App registrieren > `firebaseConfig` kopieren
5. Werte in `public/config.js` einfügen, `allowedEmail` = dein Google-Konto
6. `firestore.rules`: `DEINE.EMAIL@gmail.com` ersetzen. `.firebaserc`: Projekt-ID eintragen
7. Deploy:
   ```
   npm i -g firebase-tools
   firebase login
   firebase deploy
   ```
   URL: `https://<projekt-id>.web.app`
8. Bei anderem Hosting (Netlify / GitHub Pages): Domain unter **Authentication > Settings > Authorized domains** ergänzen. Rules dann einmalig mit `firebase deploy --only firestore:rules` deployen.

## Shortcuts
| Taste | Aktion |
|---|---|
| `N` | Neuer Task |
| `/` | Suche |
| `T` | Neues 2do |
| `Esc` | Schliessen |
| `Ctrl+Enter` | Chat senden |
| `Ctrl+Klick` auf Status | Nur diesen Status filtern |

## Datenmodell (Firestore)
```
users/{uid}/tasks/{id}  title, description, status, type (T|P), prio (1-3), progress (0-100),
                        deadline (YYYY-MM-DD), persons[], urls[{title,url,type}], chats[{ts,html}]
users/{uid}/todos/{id}  text, done, createdAt, doneAt
```
Backup/Restore: Avatar-Menü > JSON Export/Import.
