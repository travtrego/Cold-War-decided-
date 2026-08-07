(() => {
  const STORAGE_KEY = 'cold-war-live-access-code';
  const nativeFetch = window.fetch.bind(window);

  function readCode() {
    try {
      return (sessionStorage.getItem(STORAGE_KEY) || '').slice(0, 256);
    } catch {
      return '';
    }
  }

  function saveCode(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Session storage may be unavailable in hardened browsers.
    }
  }

  function clearCode() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing else to clear.
    }
  }

  function requestCode() {
    const existing = readCode();
    if (existing) return existing;

    const entered = window.prompt(
      'Enter the private Live AI access code configured in Vercel:',
    );
    const code = (entered || '').trim().slice(0, 256);
    if (code) saveCode(code);
    return code;
  }

  function isProtectedRequest(input) {
    const value = typeof input === 'string' ? input : input?.url;
    if (!value) return false;

    try {
      return ['/api/agent', '/api/missions', '/api/mission', '/api/evaluate'].includes(new URL(value, window.location.href).pathname);
    } catch {
      return false;
    }
  }

  window.fetch = async (input, init = {}) => {
    if (!isProtectedRequest(input)) return nativeFetch(input, init);

    const accessCode = requestCode();
    if (!accessCode) {
      return new Response(
        JSON.stringify({
          error: 'A Live AI access code is required.',
          code: 'ACCESS_DENIED',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      );
    }

    const sourceHeaders =
      init.headers || (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(sourceHeaders);
    headers.set('X-Live-AI-Access-Code', accessCode);

    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401) clearCode();
    return response;
  };

  document.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest?.('#modeLive');
      if (!button || button.classList.contains('locked')) return;

      if (!requestCode()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
})();
