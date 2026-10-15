import { useEffect, useMemo, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL
const foto = (n) => BASE + 'fotos/' + n

/* ------------------------------------------------------------------ ícones */
const Ico = ({ children, className = 'h-5 w-5', fill = 'none' }) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
)
const IcTesoura = (p) => (
  <Ico {...p}>
    <circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />
  </Ico>
)
const IcWhats = (p) => (
  <Ico {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M9 10c.5 2 2 3.5 4 4l1.3-1.1a.7.7 0 0 1 .8-.1l1.6.8c.3.2.4.5.3.8-.4 1.2-1.6 1.8-2.7 1.6C10.900 16.200 8 13.300 7.600 10.400c-.2-1.100.4-2.300 1.600-2.700.3-.1.600 0 .8.300l.8 1.600c.1.300 0 .6-.1.8z" /></Ico>
)
const IcPin = (p) => (
  <Ico {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Ico>
)
const IcFone = (p) => (
  <Ico {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Ico>
)
const IcCheck = (p) => (
  <Ico {...p}><polyline points="20 6 9 17 4 12" /></Ico>
)
const IcEstrela = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  </svg>
)
const IcSeta = (p) => (
  <Ico {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Ico>
)
const IcX = (p) => (
  <Ico {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Ico>
)
const IcEsq = (p) => (
  <Ico {...p}><path d="m15 18-6-6 6-6" /></Ico>
)
const IcDir = (p) => (
  <Ico {...p}><path d="m9 18 6-6-6-6" /></Ico>
)

/* ------------------------------------------------------------------ hooks */
function useVisivel(opcoes = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setOk(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOk(true); io.disconnect() } }, opcoes)
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, ok]
}

function Rev({ children, className = '', atraso = 0, as: Tag = 'div', ...rest }) {
  const [ref, ok] = useVisivel()
  return (
    <Tag ref={ref} style={{ '--d': atraso + 'ms' }} className={'rev ' + (ok ? 'on ' : '') + className} {...rest}>
      {children}
    </Tag>
  )
}

function Contador({ para, casas = 0, sufixo = '' }) {
  const [ref, ok] = useVisivel({ threshold: 0.6 })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!ok) return
    const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduz) { setV(para); return }
    let raf
    const t0 = performance.now()
    const dur = 1600
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      setV(para * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [ok, para])
  return <span ref={ref}>{v.toFixed(casas).replace('.', ',')}{sufixo}</span>
}

// Luz dourada que acompanha o mouse dentro de um cartão.
const luzMouse = (e) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', e.clientX - r.left + 'px')
  e.currentTarget.style.setProperty('--my', e.clientY - r.top + 'px')
}

// Botão "magnético": puxa levemente em direção ao cursor.
function Magnetico({ className = '', children, ...rest }) {
  const ref = useRef(null)
  const mover = (e) => {
    const el = ref.current
    if (!el || window.matchMedia('(hover: none)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width / 2) * 0.22
    const y = (e.clientY - r.top - r.height / 2) * 0.3
    el.style.transform = `translate(${x}px, ${y}px)`
  }
  const sair = () => { if (ref.current) ref.current.style.transform = '' }
  return (
    <a ref={ref} onMouseMove={mover} onMouseLeave={sair} style={{ transition: 'transform .25s ease-out' }} className={className} {...rest}>
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------ conteúdo */
const META = {
  'Corte masculino': { cat: 'Cabelo', desc: 'Corte do seu jeito, com máquina e tesoura e acabamento limpo.' },
  Barba: { cat: 'Barba', desc: 'Barba desenhada e alinhada, com acabamento na navalha.' },
  'Corte + barba': { cat: 'Combo', desc: 'O pacote completo: cabelo e barba na mesma visita.' },
  Pigmentação: { cat: 'Estética', desc: 'Realce de falhas e acabamento mais uniforme no visual.' },
  Sobrancelha: { cat: 'Estética', desc: 'Sobrancelha alinhada para completar o visual.' },
  'Corte infantil': { cat: 'Infantil', desc: 'Atendimento com paciência para os pequenos, em cadeira própria.' },
}
const ORDEM_CAT = ['Cabelo', 'Barba', 'Combo', 'Estética', 'Infantil']

const PERIODOS = [
  ['Manhã', 'manhã'],
  ['Tarde', 'tarde'],
  ['Noite', 'noite'],
  ['Qualquer horário', 'qualquer horário'],
]

const nomeDe = (x) => (typeof x === 'string' ? x : (x && (x.nome || x.titulo)) || '')

function proximosDias(n = 7) {
  const base = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    const curto = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
    const rot = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : curto.split(',')[0].replace(/^./, (c) => c.toUpperCase())
    return { id: i, rotulo: rot, data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), longo: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) }
  })
}

/* ------------------------------------------------------------------ site */
export default function Site({ dados }) {
  const { negocio, conteudo } = dados
  const servicos = (conteudo.servicos || []).map(nomeDe).filter(Boolean)
  const nota = negocio.rating ? Number(negocio.rating) : 5
  const avaliacoes = Number(negocio.avaliacoes) || 0
  const cidade = 'Cacoal · RO'
  const bairro = 'Teixeirão'
  const telefone = negocio.telefone
  const telLink = telefone ? 'tel:' + telefone.replace(/[^\d+]/g, '') : null
  const zap = negocio.whatsapp
  const mapa = 'https://maps.google.com/maps?output=embed&q=' + encodeURIComponent(negocio.nome + ', ' + negocio.endereco)
  const linkMapa = negocio.maps

  const [selecionados, setSelecionados] = useState([])
  const [filtro, setFiltro] = useState('Todos')
  const [dia, setDia] = useState(null)
  const [periodo, setPeriodo] = useState(null)
  const [nome, setNome] = useState('')
  const [progresso, setProgresso] = useState(0)
  const [rolou, setRolou] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const dias = useMemo(() => proximosDias(7), [])

  useEffect(() => {
    document.documentElement.classList.remove('sem-js')
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setProgresso(h > 0 ? window.scrollY / h : 0)
      setRolou(window.scrollY > 60)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const alternar = (s) => setSelecionados((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]))

  const categorias = ['Todos', ...ORDEM_CAT.filter((c) => servicos.some((s) => (META[s] || {}).cat === c))]
  const visiveis = servicos.filter((s) => filtro === 'Todos' || (META[s] || {}).cat === filtro)

  const mensagem = useMemo(() => {
    const d = dias.find((x) => x.id === dia)
    const partes = ['Olá, Legado Barbearia! Vim pelo site e gostaria de agendar um horário.']
    if (nome.trim()) partes.push('Meu nome: ' + nome.trim())
    partes.push('Serviço: ' + (selecionados.length ? selecionados.join(' + ') : 'ainda vou escolher'))
    if (d) partes.push('Dia: ' + d.longo)
    if (periodo) partes.push('Período: ' + periodo)
    partes.push('Pode me confirmar a disponibilidade?')
    return partes.join('\n')
  }, [selecionados, dia, periodo, nome, dias])

  const linkAgendar = zap + '?text=' + encodeURIComponent(mensagem)
  const passoOk = [selecionados.length > 0, dia !== null, periodo !== null]
  const feitos = passoOk.filter(Boolean).length

  const galeria = [
    { f: 'foto-2.jpg', t: 'Estações de atendimento', cls: 'col-span-2 row-span-2' },
    { f: 'foto-1.jpg', t: 'Nosso salão', cls: 'col-span-2' },
    { f: 'foto-4.jpg', t: 'Sala de espera', cls: '' },
    { f: 'foto-7.jpg', t: 'Cadeira infantil', cls: '' },
    { f: 'foto-6.jpg', t: 'Disciplina · Execução · Foco', cls: 'col-span-2 sm:col-span-3' },
    { f: 'foto-8.jpg', t: 'Ambiente Legado', cls: 'col-span-2 sm:col-span-1' },
  ]

  useEffect(() => {
    if (lightbox === null) return
    const tecla = (e) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox((i) => (i + 1) % galeria.length)
      if (e.key === 'ArrowLeft') setLightbox((i) => (i - 1 + galeria.length) % galeria.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', tecla)
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = '' }
  }, [lightbox])

  const rotuloSecao = 'text-xs font-semibold uppercase tracking-[0.35em] text-ouro'
  const tituloSecao = 'mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl'
  const botaoOuro = 'inline-flex items-center justify-center gap-2 rounded-full bg-ouro px-7 py-4 text-base font-semibold text-carvao shadow-[0_10px_40px_-10px_rgba(201,162,39,.7)] transition hover:bg-ouroclaro'
  const botaoVidro = 'inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-base font-medium text-white backdrop-blur transition hover:border-ouro/60 hover:bg-white/10'

  return (
    <div className="relative">
      {/* progresso */}
      <div className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left bg-ouro" style={{ transform: `scaleX(${progresso})` }} />

      {/* NAV */}
      <nav className={'fixed inset-x-0 top-3 z-50 mx-auto flex w-[calc(100%-1.5rem)] max-w-6xl items-center gap-4 rounded-full border px-4 py-2.5 backdrop-blur-xl transition-all duration-300 sm:px-6 ' + (rolou ? 'border-white/10 bg-carvao/80 shadow-2xl' : 'border-transparent bg-transparent')}>
        <a href="#topo" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-ouro/60 text-ouro"><IcTesoura className="h-4 w-4" /></span>
          <span className="font-display text-lg font-semibold tracking-wide">Legado<span className="ml-1.5 hidden text-xs font-sans font-medium uppercase tracking-[0.3em] text-white/60 sm:inline">Barbearia</span></span>
        </a>
        <div className="ml-auto hidden items-center gap-7 text-sm text-white/75 md:flex">
          <a className="transition hover:text-white" href="#servicos">Serviços</a>
          <a className="transition hover:text-white" href="#agendar">Agendar</a>
          <a className="transition hover:text-white" href="#espaco">O espaço</a>
          <a className="transition hover:text-white" href="#duvidas">Dúvidas</a>
          <a className="transition hover:text-white" href="#contato">Contato</a>
        </div>
        <a href="#agendar" className="ml-auto shrink-0 rounded-full bg-ouro px-5 py-2 text-sm font-semibold text-carvao transition hover:bg-ouroclaro md:ml-0">Agendar</a>
      </nav>

      {/* HERO */}
      <header id="topo" className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
        <img src={foto('foto-1.jpg')} alt="Interior da Legado Barbearia" className="kenburns absolute inset-0 -z-20 h-full w-full object-cover" fetchpriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-carvao via-carvao/55 to-carvao/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-carvao/85 via-carvao/30 to-transparent" />
        <div className="granulado pointer-events-none absolute inset-0 -z-10" />

        <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-40 sm:pb-28">
          <div className="subir inline-flex items-center gap-2 rounded-full border border-ouro/40 bg-carvao/50 px-4 py-1.5 text-sm backdrop-blur">
            <span className="flex text-ouro">{[0, 1, 2, 3, 4].map((i) => <IcEstrela key={i} className="h-3.5 w-3.5" />)}</span>
            <span className="text-white/90">{nota.toFixed(1).replace('.', ',')} no Google · {avaliacoes} avaliações</span>
          </div>

          <h1 className="mt-6 font-display text-[3.4rem] font-semibold leading-[0.95] tracking-tight sm:text-8xl lg:text-[9rem]">
            {['Seu', 'legado'].map((p, i) => (
              <span key={p} className="mr-4 inline-block overflow-hidden pb-3 align-bottom">
                <span className={'palavra ' + (i ? 'texto-ouro italic' : '')} style={{ animationDelay: 0.2 + i * 0.15 + 's' }}>{p}</span>
              </span>
            ))}
            <br />
            {['começa', 'aqui.'].map((p, i) => (
              <span key={p} className="mr-4 inline-block overflow-hidden pb-3 align-bottom">
                <span className="palavra" style={{ animationDelay: 0.5 + i * 0.15 + 's' }}>{p}</span>
              </span>
            ))}
          </h1>

          <p className="subir atraso-3 mt-6 max-w-xl text-lg text-white/80 sm:text-xl">
            Corte, barba e acabamento na navalha com atenção a cada detalhe — em um ambiente pensado para você relaxar. Teixeirão, Cacoal.
          </p>

          <div className="subir atraso-4 mt-9 flex flex-wrap gap-3">
            <Magnetico href="#agendar" className={botaoOuro}>Agendar meu horário <IcSeta className="h-5 w-5" /></Magnetico>
            <a href={zap} target="_blank" rel="noreferrer" className={botaoVidro}><IcWhats className="h-5 w-5" /> Chamar no WhatsApp</a>
          </div>
        </div>
        <a href="#servicos" aria-label="Rolar para baixo" className="flutuar absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-xs uppercase tracking-[0.35em] text-white/60 sm:block">Role ↓</a>
      </header>

      {/* MARQUEE */}
      <div className="overflow-hidden border-y border-white/10 bg-grafite py-5" aria-hidden="true">
        <div className="marquee">
          {[0, 1].map((v) => (
            <div key={v} className="flex shrink-0 items-center">
              {[...servicos, ...servicos].map((s, i) => (
                <span key={v + '-' + i} className="flex items-center whitespace-nowrap px-7 font-display text-2xl font-semibold uppercase tracking-wide text-white/90 sm:text-4xl">
                  {s}<IcTesoura className="ml-14 h-6 w-6 text-ouro" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* NÚMEROS */}
      <section className="mx-auto max-w-6xl px-6 pt-24">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {[
            { v: <><Contador para={nota} casas={1} /><span className="ml-1 text-ouro">★</span></>, l: 'nota média no Google' },
            { v: <><Contador para={avaliacoes} sufixo="" /><span className="text-ouro">+</span></>, l: 'avaliações de clientes' },
            { v: <span className="text-3xl sm:text-4xl">{bairro}</span>, l: cidade },
            { v: <span className="text-3xl sm:text-4xl">WhatsApp</span>, l: 'horário marcado, sem fila' },
          ].map((n, i) => (
            <Rev key={i} atraso={i * 100} className="border-l border-white/10 pl-6">
              <p className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">{n.v}</p>
              <p className="mt-2 text-sm text-white/60">{n.l}</p>
            </Rev>
          ))}
        </div>
      </section>

      {/* SOBRE */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-28 lg:grid-cols-12 lg:items-center">
        <Rev className="lg:col-span-6">
          <p className={rotuloSecao}>A Legado</p>
          <h2 className={tituloSecao}>Para quem gosta de <span className="italic text-ouro">sair bem cuidado.</span></h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">{conteudo.sobre}</p>
          <ul className="mt-8 space-y-3">
            {(conteudo.diferenciais || []).map((d) => (
              <li key={nomeDe(d)} className="flex items-start gap-3 text-white/85">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ouro/15 text-ouro"><IcCheck className="h-3.5 w-3.5" /></span>
                {nomeDe(d)}
              </li>
            ))}
          </ul>
          <a href="#agendar" className="mt-9 inline-flex items-center gap-2 font-medium text-ouro transition hover:gap-3">Quero agendar <IcSeta className="h-5 w-5" /></a>
        </Rev>
        <Rev atraso={150} className="relative lg:col-span-6">
          <div className="grid grid-cols-5 gap-4">
            <img src={foto('foto-4.jpg')} alt="Sala de espera da Legado Barbearia" loading="lazy" className="col-span-3 aspect-[3/4] w-full rounded-[2rem] object-cover" />
            <img src={foto('foto-7.jpg')} alt="Cadeira infantil em formato de carrinho" loading="lazy" className="col-span-2 mt-16 aspect-[3/4] w-full rounded-[2rem] object-cover" />
          </div>
          <div className="absolute -bottom-6 left-4 rounded-2xl border border-white/10 bg-carvao/85 p-4 shadow-2xl backdrop-blur sm:left-10">
            <p className="flex items-center gap-1 text-ouro">{[0, 1, 2, 3, 4].map((i) => <IcEstrela key={i} />)}</p>
            <p className="mt-1 text-sm text-white/80">{avaliacoes} clientes avaliaram no Google</p>
          </div>
        </Rev>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="relative border-y border-white/10 bg-grafite py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Rev className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={rotuloSecao}>Serviços</p>
              <h2 className={tituloSecao}>Escolha o seu <span className="italic text-ouro">ritual.</span></h2>
            </div>
            <div className="scroll-sem-barra -mx-6 flex max-w-full gap-2 overflow-x-auto px-6 sm:mx-0 sm:px-0" role="tablist" aria-label="Filtrar serviços">
              {categorias.map((c) => (
                <button key={c} role="tab" aria-selected={filtro === c} onClick={() => setFiltro(c)}
                  className={'shrink-0 rounded-full border px-5 py-2 text-sm transition ' + (filtro === c ? 'border-ouro bg-ouro text-carvao font-semibold' : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white')}>
                  {c}
                </button>
              ))}
            </div>
          </Rev>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((s, i) => {
              const m = META[s] || { cat: 'Serviço', desc: '' }
              const on = selecionados.includes(s)
              return (
                <Rev key={s} atraso={i * 70}>
                  <button type="button" onClick={() => alternar(s)} onMouseMove={luzMouse} aria-pressed={on}
                    className={'luz group flex h-full w-full flex-col rounded-3xl border p-7 text-left transition duration-300 hover:-translate-y-1 ' + (on ? 'border-ouro bg-ouro/10' : 'border-white/10 bg-white/[0.03] hover:border-ouro/50')}>
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ouro/15 text-ouro"><IcTesoura className="h-6 w-6" /></span>
                      <span className="text-xs uppercase tracking-[0.25em] text-white/45">{m.cat}</span>
                    </div>
                    <h3 className="mt-6 font-display text-2xl font-semibold">{s}</h3>
                    <p className="mt-2 flex-1 text-white/60">{m.desc}</p>
                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                      <span className="text-white/50">Valor: consulte no WhatsApp</span>
                      <span className={'inline-flex items-center gap-1.5 font-semibold ' + (on ? 'text-ouro' : 'text-white/80 group-hover:text-ouro')}>
                        {on ? <><IcCheck className="h-4 w-4" /> Adicionado</> : <>Adicionar</>}
                      </span>
                    </div>
                  </button>
                </Rev>
              )
            })}
          </div>
          <p className="mt-8 text-center text-sm text-white/50">Toque nos serviços que quiser e finalize o horário logo abaixo.</p>
        </div>
      </section>

      {/* AGENDAR */}
      <section id="agendar" className="mx-auto max-w-6xl px-6 py-28">
        <Rev className="mx-auto max-w-2xl text-center">
          <p className={rotuloSecao}>Agendamento</p>
          <h2 className={tituloSecao}>Reserve em <span className="italic text-ouro">30 segundos.</span></h2>
          <p className="mt-5 text-lg text-white/65">Monte seu horário aqui e a gente recebe tudo pronto no WhatsApp para confirmar.</p>
        </Rev>

        <Rev atraso={100} className="mt-14 grid gap-8 lg:grid-cols-5">
          <div className="min-w-0 space-y-9 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-9 lg:col-span-3">
            {/* progresso */}
            <div className="flex items-center gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => <span key={i} className={'h-1.5 flex-1 rounded-full transition-all duration-500 ' + (i < feitos ? 'bg-ouro' : 'bg-white/10')} />)}
            </div>

            <fieldset className="min-w-0">
              <legend className="flex items-center gap-3 text-lg font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-ouro text-sm text-carvao">1</span> O que vai ser hoje?</legend>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {servicos.map((s) => {
                  const on = selecionados.includes(s)
                  return (
                    <button key={s} type="button" onClick={() => alternar(s)} aria-pressed={on}
                      className={'rounded-full border px-5 py-2.5 text-sm transition ' + (on ? 'border-ouro bg-ouro font-semibold text-carvao' : 'border-white/15 text-white/80 hover:border-ouro/60')}>
                      {on && <IcCheck className="mr-1.5 inline h-4 w-4" />}{s}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="flex items-center gap-3 text-lg font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-ouro text-sm text-carvao">2</span> Qual dia?</legend>
              <div className="scroll-sem-barra -mx-2 mt-4 flex gap-2.5 overflow-x-auto px-2 pb-1">
                {dias.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDia(d.id)} aria-pressed={dia === d.id}
                    className={'shrink-0 rounded-2xl border px-4 py-3 text-center transition ' + (dia === d.id ? 'border-ouro bg-ouro text-carvao' : 'border-white/15 text-white/80 hover:border-ouro/60')}>
                    <span className="block text-sm font-semibold">{d.rotulo}</span>
                    <span className={'block text-xs ' + (dia === d.id ? 'text-carvao/70' : 'text-white/45')}>{d.data}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="flex items-center gap-3 text-lg font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-ouro text-sm text-carvao">3</span> Melhor período?</legend>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PERIODOS.map(([rot, val]) => (
                  <button key={val} type="button" onClick={() => setPeriodo(val)} aria-pressed={periodo === val}
                    className={'rounded-2xl border px-3 py-3 text-sm transition ' + (periodo === val ? 'border-ouro bg-ouro font-semibold text-carvao' : 'border-white/15 text-white/80 hover:border-ouro/60')}>
                    {rot}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="nome" className="flex items-center gap-3 text-lg font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-sm">4</span> Seu nome <span className="text-sm font-normal text-white/40">(opcional)</span></label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="given-name"
                className="mt-4 w-full rounded-2xl border border-white/15 bg-carvao px-5 py-3.5 text-white placeholder-white/30 outline-none transition focus:border-ouro" />
            </div>
          </div>

          {/* resumo */}
          <aside className="min-w-0 lg:col-span-2">
            <div className="luz sticky top-24 rounded-[2rem] border border-ouro/30 bg-gradient-to-b from-ouro/10 to-transparent p-7" onMouseMove={luzMouse}>
              <p className={rotuloSecao}>Seu horário</p>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-white/45">Serviço</dt><dd className="mt-0.5 text-base font-medium">{selecionados.length ? selecionados.join(' + ') : <span className="text-white/35">Escolha ao lado</span>}</dd></div>
                <div><dt className="text-white/45">Dia</dt><dd className="mt-0.5 text-base font-medium">{dia !== null ? dias[dia].longo.replace(/^./, (c) => c.toUpperCase()) : <span className="text-white/35">Escolha ao lado</span>}</dd></div>
                <div><dt className="text-white/45">Período</dt><dd className="mt-0.5 text-base font-medium">{periodo ? periodo.replace(/^./, (c) => c.toUpperCase()) : <span className="text-white/35">Escolha ao lado</span>}</dd></div>
              </dl>
              <a href={linkAgendar} target="_blank" rel="noreferrer" className={botaoOuro + ' mt-8 w-full'}><IcWhats className="h-5 w-5" /> Confirmar no WhatsApp</a>
              <p className="mt-4 text-center text-xs text-white/45">Você revisa a mensagem antes de enviar. A disponibilidade é confirmada pela equipe.</p>
            </div>
          </aside>
        </Rev>
      </section>

      {/* GALERIA */}
      <section id="espaco" className="border-t border-white/10 bg-grafite py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Rev className="max-w-2xl">
            <p className={rotuloSecao}>O espaço</p>
            <h2 className={tituloSecao}>Entre. <span className="italic text-ouro">Fique à vontade.</span></h2>
          </Rev>
          <div className="mt-12 grid auto-rows-[200px] grid-cols-2 gap-3 sm:auto-rows-[230px] sm:grid-cols-4 sm:gap-4">
            {galeria.map((g, i) => (
              <Rev key={g.f} atraso={i * 60} className={'group relative overflow-hidden rounded-3xl ' + g.cls}>
                <button type="button" onClick={() => setLightbox(i)} className="absolute inset-0 h-full w-full" aria-label={'Ampliar foto: ' + g.t}>
                  <img src={foto(g.f)} alt={g.t} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                  <span className="absolute inset-0 bg-gradient-to-t from-carvao/80 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                  <span className="absolute bottom-4 left-5 translate-y-2 text-left text-sm font-medium opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">{g.t}</span>
                </button>
              </Rev>
            ))}
          </div>
        </div>
      </section>

      {/* PASSOS */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <Rev className="max-w-2xl">
          <p className={rotuloSecao}>Como funciona</p>
          <h2 className={tituloSecao}>Simples como <span className="italic text-ouro">deve ser.</span></h2>
        </Rev>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {(conteudo.passos || []).map((p, i) => (
            <Rev key={p} atraso={i * 120} className="luz rounded-3xl border border-white/10 bg-white/[0.03] p-8" onMouseMove={luzMouse}>
              <span className="font-display text-7xl font-semibold text-ouro/25">0{i + 1}</span>
              <p className="mt-4 font-display text-2xl font-semibold">{p}</p>
            </Rev>
          ))}
        </div>
      </section>

      {/* AVALIAÇÕES */}
      <section className="border-y border-white/10 bg-grafite py-24">
        <Rev className="mx-auto max-w-3xl px-6 text-center">
          <p className={rotuloSecao}>Quem já sentou na cadeira</p>
          <p className="mt-6 font-display text-8xl font-semibold text-white sm:text-9xl">{nota.toFixed(1).replace('.', ',')}</p>
          <p className="mt-3 flex justify-center gap-1 text-ouro">{[0, 1, 2, 3, 4].map((i) => <IcEstrela key={i} className="h-7 w-7" />)}</p>
          <p className="mt-4 text-xl text-white/75">{avaliacoes} avaliações no Google — nota máxima.</p>
          <a href={linkMapa} target="_blank" rel="noreferrer" className={botaoVidro + ' mt-9'}>Ver avaliações no Google <IcSeta className="h-5 w-5" /></a>
        </Rev>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="mx-auto grid max-w-6xl gap-12 px-6 py-28 lg:grid-cols-12">
        <Rev className="lg:col-span-4">
          <p className={rotuloSecao}>Dúvidas</p>
          <h2 className={tituloSecao}>Perguntas <span className="italic text-ouro">frequentes.</span></h2>
        </Rev>
        <div className="space-y-3 lg:col-span-8">
          {(conteudo.faq || []).map((f, i) => (
            <Rev key={f.p} atraso={i * 80}>
              <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 open:border-ouro/40 open:bg-ouro/[0.06]">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-medium">
                  {f.p}
                  <span className="mais grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 text-xl leading-none text-ouro transition-transform duration-300">+</span>
                </summary>
                <p className="mt-4 leading-relaxed text-white/65">{f.r}</p>
              </details>
            </Rev>
          ))}
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="relative isolate overflow-hidden border-t border-white/10">
        <img src={foto('foto-6.jpg')} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-carvao/90" />
        <div className="mx-auto max-w-6xl px-6 py-28">
          <Rev className="max-w-4xl">
            <p className={rotuloSecao}>Contato</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[1] tracking-tight sm:text-7xl lg:text-8xl">Seu próximo corte está a <span className="texto-ouro italic">uma mensagem.</span></h2>
          </Rev>
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <Rev atraso={100} className="space-y-6">
              <div className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ouro/15 text-ouro"><IcPin /></span>
                <div><p className="text-sm text-white/45">Endereço</p><p className="mt-1 text-lg">{negocio.endereco.replace(', Brasil', '')}</p></div>
              </div>
              {telefone && (
                <div className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ouro/15 text-ouro"><IcFone /></span>
                  <div><p className="text-sm text-white/45">Telefone / WhatsApp</p><a href={telLink} className="mt-1 block text-lg transition hover:text-ouro">{telefone}</a></div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Magnetico href={zap} target="_blank" rel="noreferrer" className={botaoOuro}><IcWhats className="h-5 w-5" /> Agendar no WhatsApp</Magnetico>
                <a href={linkMapa} target="_blank" rel="noreferrer" className={botaoVidro}><IcPin className="h-5 w-5" /> Como chegar</a>
              </div>
            </Rev>
            <Rev atraso={200} className="overflow-hidden rounded-[2rem] border border-white/10">
              <iframe title={'Mapa — ' + negocio.nome} src={mapa} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[340px] w-full border-0 grayscale invert-[.92] contrast-[.9] sm:h-[400px]" />
            </Rev>
          </div>
        </div>
      </section>

      <div className="listra-barbeiro h-2" aria-hidden="true" />
      <footer className="bg-carvao px-6 py-10 text-center text-sm text-white/45">
        <p className="font-display text-xl font-semibold text-white/80">Legado Barbearia</p>
        <p className="mt-2">{negocio.endereco.replace(', Brasil', '')}</p>
        <p className="mt-6">© {new Date().getFullYear()} Legado Barbearia · Todos os direitos reservados</p>
      </footer>

      {/* WhatsApp flutuante */}
      <a href={zap} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp"
        className="pulso fixed bottom-5 right-5 z-50 grid h-16 w-16 place-items-center rounded-full bg-[#25D366] text-white shadow-2xl transition hover:scale-110">
        <IcWhats className="h-8 w-8" />
      </a>

      {/* LIGHTBOX */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Galeria de fotos" onClick={() => setLightbox(null)}>
          <button className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Fechar" onClick={() => setLightbox(null)}><IcX /></button>
          <button className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 sm:left-8" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + galeria.length) % galeria.length) }}><IcEsq /></button>
          <button className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 sm:right-8" aria-label="Próxima foto" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % galeria.length) }}><IcDir /></button>
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={foto(galeria[lightbox].f)} alt={galeria[lightbox].t} className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain" />
            <figcaption className="mt-4 text-center text-white/70">{galeria[lightbox].t} · {lightbox + 1}/{galeria.length}</figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
