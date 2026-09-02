# Private SAE sync

The dashboard reads SAE A2:AZ directly through Google Sheets API with the viewer's Google authorization. Tracker is a reference for stage/action rules only; it is never a runtime data source. All numbered equipment rows, including rows after blanks and every Type, belong to Import. Manufacture is unchanged. Pending excludes Overall status = Dispatched and Fixture Manufacturer = Cancelled. Dates use unformatted serial values; BFIH site arrive stays a location string.

## One-time Google setup

1. In a Google Cloud project enable Google Sheets API.
2. Configure Google Auth Platform branding/audience. If the app is in testing, add the intended users as test users.
3. Create an OAuth client of type Web application. Authorized JavaScript origin: `https://evan-hieu.github.io`. For local testing also add `http://127.0.0.1:8765`.
4. Put its public client ID (ending in `.apps.googleusercontent.com`) in `google-config.js`. Do not provide a client secret.
5. Deploy, click Google Sheet in the sidebar, and sign in with an account that can read the source spreadsheet.

The app requests spreadsheets.readonly. This scope is not limited to one spreadsheet by Google; the application only requests the configured SAE range. Review that scope before consenting. Sheet sharing permissions remain unchanged. No real rows or tokens are saved to Git, localStorage, or a server. Before sign-in, the dashboard shows an explicit not-connected state without loading sample data. Sync refreshes every minute while the page is visible, immediately when the page becomes visible again, and on clicking Google Sheet. A transient refresh failure preserves the last verified data and retries automatically. When the access token expires, user interaction is required to reconnect; this frontend has no persistent refresh token.

## Verification required before release

- Finish OAuth setup and test authorized/unauthorized accounts against the live Sheet.
- Verify serial-date parsing, counts, partial dispatch stages, cancelled rows and all rows after the blank separator.
- Ensure real rows never appear in committed files, logs, or unauthenticated responses.

References: https://developers.google.com/identity/oauth2/web/guides/use-token-model and https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get

Columns are matched by normalized header names, including the inserted Dispatched Qty and Pending qty fields. Quantity values are displayed as supplied (including zero and negative values); no quantity formula is inferred.
