# 💸 Expense Tracker

A mobile app (React Native + Expo) that tracks your expenses. You can log spending by sending it a message,
and all data is stored **only on your phone**.

## Features

| | |
|---|---|
| 💬 **Chat to log expenses** | Type it like a text message: `lunch 1200`, `450 coffee`, `taxi 1.5k #transport`, `groceries 3200 yesterday`. Several lines add several expenses. Commands: `today`, `week`, `month`, `recent`, `undo`, `help`. |
| ✉️ **Bank SMS import** (Android) | Reads bank and card alerts such as *"LKR 2,500.00 debited … at KEELLS SUPER"*, works out the amount, merchant and category, and skips OTPs, credits and balance lines. Import them yourself or turn on **auto-import**. |
| ↗️ **Share from any messaging app** | In WhatsApp, Messages, Telegram and other apps, long-press a message → **Share** → **Expense Tracker**. It's logged straight away. |
| 🏠 **Monthly overview** | Total for the month and today, daily average, a daily spending chart, a category breakdown, and a monthly budget bar. |
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
    parser.ts             turns messages / bank SMS into expenses (unit tested)
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
