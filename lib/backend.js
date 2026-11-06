// KI-Log C25 (mit Claude Opus 5.5-Unterstützung)
// Gemeinsamer Aufruf des Kern-Backends.
// Das Backend nimmt nur Anfragen vom BFF an. Dafür schickt das BFF bei jedem Aufruf
// den Header X-Internal-Key mit dem Wert aus INTERNAL_API_KEY mit.
// Ist die Variable leer (z. B. lokal), wird kein Header geschickt.

// Ergänzt die übergebenen Header um X-Internal-Key, falls ein Schlüssel gesetzt ist.
function backendHeaders(headers = {}) {
  const key = process.env.INTERNAL_API_KEY;

  if (!key) {
    return { ...headers };
  }

  return { ...headers, "X-Internal-Key": key };
}

// Wie fetch, nur mit X-Internal-Key. Wird statt fetch für alle Aufrufe ans Backend genutzt.
function backendFetch(url, options = {}) {
  return fetch(url, { ...options, headers: backendHeaders(options.headers) });
}

module.exports = { backendFetch, backendHeaders };
