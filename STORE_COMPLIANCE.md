# StartFit — App Store and Google Play privacy answers

Answers for the store forms, written from what the code does (checked 2026-10-14).
If you add an SDK, analytics, ads, Apple Health / Health Connect, photos or anything else that sends data off the device,
these answers and `src/lib/legal/privacy-policy.ts` must be updated **before** that version is submitted.

## 0. Before you submit (fill these in)

1. In `src/lib/legal/privacy-policy.ts`, replace every `[[...]]` in `PLACEHOLDERS`:
   your legal name or company, postal address, privacy email, minimum age, Supabase region,
   Supabase backup period, and the US transfer safeguard (check the data processing agreements of OpenAI and Stripe).
2. Run `node scripts/generate-privacy-html.mjs` — it rebuilds `public/privacy.html` and `public/delete-account.html`
   and warns while placeholders remain.
3. Deploy (see README → "Privacy, consent and account deletion"), then open both pages in a private browser window:
   they must load without signing in, without errors, and not as a PDF.
4. Have a lawyer or privacy professional review the policy. This document is not legal advice.

URLs to enter in both stores:

| Field | Value |
|---|---|
| Privacy Policy URL | `https://<your-domain>/privacy.html` |
| Account deletion URL (Google Play, Data safety → Data deletion) | `https://<your-domain>/delete-account.html` |

## 1. Apple — App Store Connect → App Privacy

**Tracking:** No. StartFit has no ads, no advertising SDKs, no analytics SDKs and does not share data with data brokers.

**Data collected** — every type below is **Linked to the user**, **not used for tracking**, purpose **App Functionality**
(Apple: "enable features, authenticate the user, … perform customer support"):

| Apple category → type | What it is in StartFit |
|---|---|
| Contact Info → Email Address | Sign-in email |
| Contact Info → Name | Display name |
| Health & Fitness → Health | Screening answers, pain reports and symptoms, body measurements, meals and nutrition, sleep, soreness, stress, mood, resting heart rate / HRV if entered, cycle dates (optional) |
| Health & Fitness → Fitness | Workouts, sets, weights, reps, session effort, routines |
| Sensitive Info → Sensitive Info | The training screening asks about pregnancy (Apple lists "pregnancy or childbirth information" as Sensitive Info) |
| User Content → Other User Content | Messages to the AI coaches, memory entries, notes |
| Identifiers → User ID | Account ID |
| Purchases → Purchase History | Plan and subscription status |
| Usage Data → Other Usage Data | Daily coach-message count (for the plan's limit) |
| Search History → Search History | Food search words and barcodes — **Not linked to the user** (stored in a shared cache without any account link) |

Not collected: Payment Info (card details are entered with Stripe, never seen by the app — Apple says this is not "collected"),
Location, Contacts, Photos or Videos, Audio, Browsing History, Device ID, Diagnostics, Product Interaction, Advertising Data.

**Review notes (App Review Information → Notes)** — suggested text:

> Account deletion: Account → Settings → Privacy & Data → Delete account (type DELETE). It deletes the account and all data on our server and cancels an active subscription.
> AI: The coaches use OpenAI. Before any data is sent, the app shows what is sent and to whom, and asks for permission (Allow and continue). It can be switched off in Settings → Privacy & Data; the server also refuses AI requests without that permission.
> Health data is used only to provide the app's features. It is never used for advertising or marketing and is not stored in iCloud.
> Demo account: <email> / <password>

Guidelines this covers: 5.1.1(i) privacy policy in the store and in the app; 5.1.1(v) in-app account deletion;
5.1.2(i) third-party AI disclosure and explicit permission; 5.1.2(vi) and 5.1.3 health data not used for advertising;
1.4.1 reminder to check with a doctor (shown on the health-data consent screen and in the policy).

## 2. Google Play — Play Console → App content

### Privacy policy
Enter the Privacy Policy URL above. The app also links to it from sign-up, the health-data consent screen, the AI permission card and Settings.

### Data safety

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only).
- **Do you provide a way for users to request that their data is deleted?** Yes — in the app, and at the account deletion URL.
- **Account creation:** the app lets people create an account with email and password. Enter the account deletion URL.
- **Shared:** No. Supabase, OpenAI, Stripe, USDA and Open Food Facts act as service providers for StartFit, which Google exempts from "sharing"; the AI transfer also only happens after the in-app disclosure and permission.

Collected (all **required to use the related feature**, processed **not ephemerally**, purpose **App functionality**;
email and user ID also **Account management**):

| Google category → type | Optional? |
|---|---|
| Personal info → Name | Required |
| Personal info → Email address | Required |
| Personal info → User IDs | Required |
| Personal info → Other info (age, sex) | Required |
| Health and fitness → Health info | Required |
| Health and fitness → Fitness info | Required |
| Financial info → Purchase history | Optional (only for people who subscribe) |
| Messages → Other in-app messages (AI coach chats) | Optional (only if the person allows the AI coaches) |
| App activity → In-app search history (food search) | Optional |
| App activity → Other user-generated content (notes, memory entries) | Optional |

Not collected: User payment info, location, photos, videos, audio, files, calendar, contacts, web browsing, crash logs, diagnostics, device IDs.

### Health apps declaration
Select what the app actually does:
- **Activity and Fitness** — training plans and workout logging
- **Nutrition and Weight Management** — food diary, targets, weight
- **Period Tracking** — optional cycle insights
- **Sleep Management** — sleep logging and sleep-debt guidance
- **Physical Therapy and Rehabilitation** — the return-to-training programme after pain or injury. This is a medical category; declare it as long as that feature is in the app (declaring less than the app does can get it rejected).

Do not select "Medical Device Apps": StartFit is not registered as a medical device.

## 3. Payments in the native apps (decide before the iOS/Android build)

StartFit sells subscriptions through Stripe on the web.
- **Apple 3.1.1:** subscriptions that unlock features inside an iOS app must use Apple in-app purchase. In storefronts other than the United States, the app may not show buttons or links to the Stripe checkout without an Apple entitlement.
- **Google Play Payments policy:** digital subscriptions in a Play app must use Google Play Billing, except where Google's alternative or user-choice billing programmes apply.

So the native apps need in-app purchase (for example via RevenueCat or StoreKit / Play Billing), or must hide purchasing in the native apps. This is a business decision for you, and it must be settled before submission.

## 4. If you add Apple Health / Health Connect later

- Apple: add `NSHealthShareUsageDescription` (and `NSHealthUpdateUsageDescription` only if you write), enable the HealthKit capability, never store HealthKit data in iCloud, and never use it for advertising (5.1.2(vi), 5.1.3).
- Google: declare each Health Connect permission in Play Console → App content → Health Connect, with the reason; request only the data types the app uses.
- Update section 11 of the privacy policy with the exact data types, regenerate the HTML, and re-answer sections 1 and 2 above **before** that version is released.
