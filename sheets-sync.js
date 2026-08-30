(() => {
  let token = null, expiresAt = 0, client = null, timer = null, busy = false;
  const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
  const status = message => { document.getElementById('syncStatus').textContent = message; };
  function clearSession() {
    token = null; expiresAt = 0; clearInterval(timer); timer = null;
  }
  async function refresh() {
    if (busy) return;
    if (!token || Date.now() >= expiresAt) {
      clearSession(); status('Session expired — click Google Sheet to reconnect'); return;
    }
    busy = true; status('Syncing SAE…');
    try {
      const range = encodeURIComponent("'SAE'!A2:AH");
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SaeSource.SHEET_ID}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, {
        headers: {Authorization:`Bearer ${token}`}, cache:'no-store', signal:AbortSignal.timeout(20000)
      });
      if (response.status === 401) { clearSession(); throw new Error('Session expired — reconnect Google Sheet'); }
      if (response.status === 403) throw new Error('Access denied — check Sheet access and Sheets API setup');
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      const payload = await response.json();
      const items = SaeSource.mapRows(payload.values);
      window.loadSaeItems(items);
      status(`SAE · ${items.length} items · Synced ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    } catch (error) {
      status(`${error.name === 'TimeoutError' ? 'Sync timed out' : error.message} · data not refreshed`);
    } finally { busy = false; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('googleSheetLink').addEventListener('click', event => {
      event.preventDefault();
      if (!window.SAE_GOOGLE_CLIENT_ID) { status('Google Sheets setup required — OAuth client ID missing'); return; }
      if (!window.google?.accounts?.oauth2) { status('Google sign-in unavailable — reload and retry'); return; }
      if (token && Date.now() < expiresAt) { refresh(); return; }
      if (!client) client = google.accounts.oauth2.initTokenClient({
        client_id:window.SAE_GOOGLE_CLIENT_ID, scope, include_granted_scopes:false,
        callback:response => {
          if (response.error || !response.access_token) { status('Google connection not authorized'); return; }
          if (!google.accounts.oauth2.hasGrantedAllScopes(response, scope)) { status('Read-only Sheets permission required'); return; }
          token = response.access_token; expiresAt = Date.now() + Number(response.expires_in) * 1000 - 60000;
          clearInterval(timer); refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
        },
        error_callback:() => status('Google sign-in cancelled or popup blocked — retry Google Sheet')
      });
      client.requestAccessToken();
    });
  });
})();
