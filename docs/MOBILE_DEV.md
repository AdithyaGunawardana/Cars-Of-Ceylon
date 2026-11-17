# Running the mobile app on a phone

The app is an Expo (SDK 58) React Native app in `mobile/`. During development it runs inside **Expo Go**, which loads the code from your PC over Wi-Fi. No Android Studio or Xcode is needed.

## What must be true
- The PC and the phone are on the **same Wi-Fi network** (not a guest or "client isolated" network).
- Expo Go on the phone supports **SDK 58** (its home screen shows the supported SDK).
- The web server, database and photo storage are running on the PC (see the root README).

## One-time setup (Windows)
1. **Find the PC's Wi-Fi address**: run `ipconfig` and note the IPv4 address of the Wi-Fi adapter, e.g. `192.168.1.23`.
2. **Allow the ports through Windows Firewall** (Private network). In an Administrator PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName "Cars of Ceylon dev" -Direction Inbound -Protocol TCP -LocalPort 3000,8081,9000 -Action Allow -Profile Private
   ```
   - 3000 = web API, 8081 = Expo/Metro bundler, 9000 = MinIO photo storage.
   - Make sure the Wi-Fi network is marked **Private** in Windows settings.
3. **Make photo uploads work from the phone.** Upload links are signed for one specific host, so MinIO must be addressed by the PC's LAN IP. In `web/.env` set (replace the IP):
   ```
   UPLOAD_S3_ENDPOINT="http://192.168.1.23:9000"
   UPLOAD_S3_PUBLIC_BASE_URL="http://192.168.1.23:9000/cars-of-ceylon"
   ```
   Restart `npm run dev` afterwards. (Browsing still works on the PC with these values. Revert them to `localhost` if you prefer.)
   Photos that were uploaded earlier are stored with `localhost` links; the app rewrites those for display automatically.

## Every time
Three terminals (or one terminal for each step):
```powershell
# 1. database + photo storage (once per boot)
docker start coc_db coc_minio

# 2. the web app / API
cd web
npm run dev

# 3. the mobile app
cd mobile
npm install        # first time only
npm start          # = expo start --go (Expo Go mode)
```
Open **Expo Go** on the phone and scan the QR code. (Android: scan with the Expo Go app itself.) The first time, Expo Go shows a **"Local network access needed"** banner: tap it and allow, otherwise it cannot see your PC.

Use `npm start`, not a bare `npx expo start`: the project includes `expo-dev-client` (for EAS development builds), which makes a bare `expo start` print a QR code for development builds (`exp+cars-of-ceylon-mobile://...`) that Expo Go cannot open. If you ever see "no app on this device can handle it", press `s` in the Expo terminal to switch to Expo Go. For a development build use `npm run start:dev-client`.

The app finds the API automatically: Expo Go knows the PC's address, so it uses `http://<that address>:3000`. On the sign-in screen (development only) the line **"Server: ..."** shows which address it picked. To override it, create `mobile/.env.local`:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
```
and restart `expo start`.

## Signing in
- Admin: `admin@carsofceylon.local` with `SEED_ADMIN_PASSWORD` from `web/.env` (shows Moderation features).
- Or register a new account in the app. Reset/verification emails are printed in the `npm run dev` terminal when no `SMTP_URL` is set.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Could not reach the server" | Check the "Server:" line on the sign-in screen, that `npm run dev` is running, that phone and PC share Wi-Fi, and the firewall rule above. Open `http://<PC IP>:3000` in the phone's browser to test. |
| "Can't open this project ... no app on this device can handle it" (`exp+cars-of-ceylon-mobile://`) | Expo is in development-build mode. Stop it and run `npm start` (or press `s` in the Expo terminal to switch to Expo Go). |
| Expo Go cannot load the project | Allow "Local network access" in Expo Go, then try `npx expo start --tunnel` (slower, works across networks), or check that port 8081 is allowed. |
| Photos upload fails, text works | `UPLOAD_S3_ENDPOINT` still says `localhost` (step 3), or port 9000 is blocked. |
| Photos show as blank | Port 9000 blocked, or the bucket is not public (see root README). |
| Signed out unexpectedly | Normal after a password reset/change, a ban, or 180 days. Sign in again. |
| Android shows a red error screen | Shake the phone -> Reload. The Metro terminal shows the real error. |

## How sign-in works (for reference)
- The app signs in at `POST /api/mobile/auth/login` and receives a 15-minute **access token** (kept in memory) and a single-use **refresh token** (kept in the phone's secure keystore).
- Every API call sends `Authorization: Bearer <access token>`. When it nears expiry, or the server answers 401, the app swaps the refresh token for a new pair automatically.
- A refresh token can be used once. If an old one is replayed, the server revokes that device's whole session, so a stolen token only works until the real app next refreshes.
- Banning a user, or resetting their password, signs the phone out the next time it refreshes (within 15 minutes).

## Checks that run before merge
`cd mobile && npm run lint && npm run typecheck && npm test` (also run by the `mobile-quality` CI job together with an Android bundle build).

## Builds (EAS)
`mobile/eas.json` defines three profiles:
- `development`: a development client (APK) that allows plain-HTTP API access for LAN testing. Use it if Expo Go ever lags behind the SDK.
- `preview`: internal APK pointing at the staging API (fill in the URL in `eas.json`).
- `production`: store build; the app **refuses to start against a non-HTTPS API address**.

Replace the `REPLACE-WITH-YOUR-DOMAIN` placeholders once a host and domain exist (P5). Building needs an Expo account (`npx eas login`); Android builds are free, iOS builds need a paid Apple developer account.
