/* Notificações push (servidor → celular), carregado dentro do service worker do app.
   Com o app aberto e na frente, quem avisa é o próprio app (bipe + mensagem) — aqui só mostra a
   notificação do celular quando nenhuma janela do app está visível. */
self.addEventListener('push', event => {
  let dados = {}
  try { dados = event.data ? event.data.json() : {} } catch { dados = { titulo: 'Aviso', corpo: event.data ? event.data.text() : '' } }
  const titulo = dados.titulo || 'Aviso'
  const opcoes = {
    body: dados.corpo || '',
    icon: dados.icone || '/icon-192.png',
    badge: '/icon-192.png',
    tag: dados.tag || undefined,
    renotify: !!dados.tag && dados.renotificar !== false,
    vibrate: [200, 100, 200],
    data: { url: dados.url || '/' },
  }
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const visivel = janelas.some(j => j.visibilityState === 'visible')
    if (visivel) {
      janelas.forEach(j => j.postMessage({ tipo: 'push-recebido', titulo, corpo: opcoes.body, tag: dados.tag || '' }))
      return
    }
    await self.registration.showNotification(titulo, opcoes)
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const aberta = janelas.find(j => j.url.includes(url)) || janelas[0]
    if (aberta) return aberta.focus()
    return self.clients.openWindow(url)
  })())
})
