/** Service worker: é ele que faz o "sem internet" do README valer também para
 *  quem instalou pelo navegador.
 *
 *  Sem service worker, `display: standalone` no manifest é promessa falsa: o
 *  atalho na tela de início abre a página de erro do navegador no subsolo da
 *  academia, que é justamente onde o app precisa funcionar.
 *
 *  Duas estratégias, porque são dois tipos de arquivo:
 *
 *  - **Documento primeiro pela rede.** O HTML aponta para o bundle com hash no
 *    nome, então servir HTML velho do cache prenderia a pessoa numa versão
 *    antiga para sempre. Offline, cai para o cache.
 *  - **Resto primeiro pelo cache.** Bundle, ícones e manifest têm hash ou não
 *    mudam; buscar na rede o que já está guardado só gasta tempo e dados.
 *
 *  Nada é pré-cacheado na instalação além do endereço-raiz: o nome do bundle
 *  muda a cada build e não dá para escrevê-lo aqui. A primeira visita online é
 *  que enche o cache — e é a mesma visita em que a pessoa instala o atalho.
 */

/* Subir esta versão apaga o cache anterior inteiro. Serve para quando algo
   ficar preso em cache e for preciso limpar o campo de uma vez. */
const CACHE = 'nosso-treino-v1';

/* O escopo já vem da pasta onde o arquivo está servido (/nosso-treino/), então
   o endereço-raiz é relativo a ele — nada de caminho escrito à mão. */
const RAIZ = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(RAIZ)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Guarda só o que é nosso e deu certo: resposta de outra origem vem opaca
 *  (status 0) e cacheá-la esconderia um erro dentro do cache. */
const guarda = (req, res) => {
  if (res.ok && res.type === 'basic') {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => guarda(req, res))
        // offline: a própria rota, e se ela nunca foi visitada, a raiz — o
        // roteador do app assume dali e mostra a tela certa
        .catch(() => caches.match(req).then((r) => r || caches.match(RAIZ))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => guarda(req, res))),
  );
});
