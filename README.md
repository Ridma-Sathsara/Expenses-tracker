# 💸 Expense Tracker

A mobile app (React Native + Expo) that tracks your **cash in and cash out**. You can log money by sending it a message,
and all data is stored **only on your phone**.

## Features

| | |
|---|---|
| 💬 **Chat to log expenses** | Type it like a text message: `lunch 1200`, `450 coffee`, `taxi 1.5k #transport`, `groceries 3200 yesterday`. Start with `+` or use words like `salary` / `received` for cash in: `+150000 salary`. Several lines add several entries. Commands: `today`, `week`, `month`, `balance`, `recent`, `undo`, `help`. |
| ✉️ **Bank SMS import** (Android) | Reads bank and card alerts such as *"LKR 2,500.00 debited … at KEELLS SUPER"*, and credit alerts (*"LKR 50,000.00 credited…"*), works out the amount, merchant or sender and category, and skips OTPs, promotions and balance lines. Senders on the ignored list (COMBANK by default) are never counted. Import them yourself or turn on **auto-import**. |
| ↗️ **Share from any messaging app** | In WhatsApp, Messages, Telegram and other apps, long-press a message → **Share** → **Expense Tracker**. It's logged straight away. |
| 🏠 **Cash-flow overview** | Cash in, cash out and net (in − out) for the month and since your tracking start date, a daily cash-out chart, breakdowns of where money went and came from, and a cash-out budget bar. |
| 📅 **Tracking start date** | Nothing before the start date (default 10 Nov 2026, editable in Settings) is counted, listed or imported. Older entries are hidden, not deleted. |
| ✏️ **Edit anything** | Tap an expense to change its amount, note, category or date, or delete it. |
| 📤 **CSV export** | Back up or open your data in Excel or Google Sheets. |
| 🔒 **Private** | Uses on-device SQLite. There's no server, account or internet access involved. |

## Install on your phone (no PC needed)

1. On your Android phone, open **https://github.com/ridma-sathsara/expenses-tracker/releases/latest**
2. Download the `ExpenseTracker-….apk` file.
3. Open it. If Android asks, allow **"Install unknown apps"** for your browser, then tap **Install**.
4. Open **Expense Tracker**. Go to the **SMS** tab and tap **Allow SMS access** if you want bank alerts imported.

> Play Protect may warn that the app is from an unknown developer. That's normal for apps that aren't on the
> Play Store. Tap **More details → Install anyway**.

**Updating:** every push to GitHub builds a new APK (see the **Actions** tab). Install the newer APK over the old
one. Your data is kept.

### iPhone?
iOS doesn't allow apps to read SMS, and installing apps outside the App Store needs an Apple Developer account. The
code is cross-platform (chat, manual entry and charts all work on iOS), but this repo only builds Android for now.

## Tech stack

- **React Native 0.88 + Expo SDK 58**, TypeScript
- **expo-sqlite**: local database on the phone
- **Custom native module** (`modules/sms-reader`, Kotlin): reads the SMS inbox on Android
- **expo-sharing**: receives text shared from other apps, and exports CSV
- **GitHub Actions**: builds and publishes the APK in the cloud (`.github/workflows/android.yml`)

## Project structure

```
src/
  App.tsx                 tabs, share handling, SMS auto-import
  screens/                Home, Chat, SMS, Settings
  components/             ExpenseEditor (add/edit sheet), ExpenseRow
  lib/
    parser.ts             turns messages / bank SMS into cash-in / cash-out entries (unit tested)
    ledger.ts             cash-flow maths: in, out, net, tracking start (unit tested)
    categories.ts         categories + keyword-based auto-categorisation
    chatBot.ts            chat commands and replies
    db.ts                 SQLite storage
    sms.ts                SMS scan / import / auto-import
modules/sms-reader/       native Android SMS module (Kotlin)
```

## Development (when you have a computer)

```bash
npm install
npm test             # parser unit tests
npm run typecheck
npx expo run:android # needs Android Studio / SDK; Expo Go can't load the custom SMS module
```

### Your bank's SMS not detected?
Add a sample message (with personal details removed) to `src/lib/__tests__/parser.test.ts`, adjust
`src/lib/parser.ts`, and run `npm test`.
