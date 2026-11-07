# Family scoreboard setup (Google Sheet)

This connects the quiz to one shared Google Sheet so every device sees the same scores.
You only do this once. It takes about 5 minutes and needs a Google account.

## 1. Create the Apps Script project

1. Open <https://script.google.com> and sign in with the family Google account.
2. Click **New project** (top left).
3. Delete the sample code in the editor.
4. Open `apps-script/Code.gs` from this repository, copy **all** of it, and paste it into the editor.
5. Click the **Save** icon (or press Ctrl/Cmd + S).

## 2. Publish it as a web app

1. Click **Deploy** (top right) → **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description**: `Geografia scores`
   - **Execute as**: **Me**
   - **Who has access**: **Anyone**
4. Click **Deploy**.
5. Google asks for permission: click **Authorize access**, pick your account, click **Advanced** →
   **Go to Geografia scores (unsafe)** → **Allow**. This warning is normal for your own scripts.
6. Copy the **Web app URL**. It ends in `/exec`.

## 3. Point the app at the script

1. Open `js/config.js`.
2. Paste the URL between the quotes of `sheetUrl`, for example:

   ```js
   const GeoConfig = { sheetUrl: 'https://script.google.com/macros/s/AKfy.../exec' };
   ```

3. Save the file, then commit and push:

   ```
   git add js/config.js
   git commit -m "Point the app at the family scoreboard"
   git push
   ```

## 4. Find the spreadsheet

The script creates the spreadsheet the first time a game is sent.

1. Open <https://drive.google.com>.
2. Search for **Geografía – Scores**.
3. Open it. The `Scores` sheet has one row per game, with a header row.

If you want to see it immediately, play one game in the app first.

## 5. Check that it works

1. Open the app and play a short game.
2. Open the spreadsheet: a new row should appear within a few seconds.
3. Open the Stats screen: the ranking should show the family's games and a "Synced with the
   family scoreboard" line.

If a game cannot be sent (no internet), it is kept on the device and sent automatically the next
time the app has a connection.

## 6. Update the script later

After you edit `apps-script/Code.gs`, the published URL does **not** change, but you must publish
the new version:

1. Copy the new `Code.gs` into the same Apps Script project and save.
2. Click **Deploy** → **Manage deployments**.
3. Click the pencil (edit) icon on the existing deployment.
4. Under **Version**, choose **New version**, then click **Deploy**.

Do not create a second deployment: that would give you a different URL and the app would keep
talking to the old code.
