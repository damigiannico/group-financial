'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function SignIn() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('')
  async function submit(e: React.FormEvent) { e.preventDefault(); const result = await authClient.signIn.email({ email, password }); if (result.error) setError('No pudimos iniciar sesión. Revisá tus datos.'); else { router.push('/'); router.refresh() } }
  return <main className="auth-page"><section className="auth-aside"><div className="auth-brand"><span className="brand-mark">◎</span> Finanzas compartidas</div><div><p className="auth-kicker">FINANZAS COMPARTIDAS</p><h2>Ordenar la plata también puede sentirse simple.</h2><p className="auth-aside-copy">Un espacio claro para que tu grupo decida, registre y avance en conjunto.</p></div><div className="auth-aside-footer"><span className="auth-dot" /> Privado para tu grupo</div></section><form className="auth-card" onSubmit={submit}><div className="auth-mobile-brand"><span className="brand-mark">◎</span> Finanzas compartidas</div><div className="auth-kicker">FINANZAS COMPARTIDAS</div><h1>Ingresá a tu cuenta</h1><p className="auth-intro">Accedé a las finanzas de tu grupo y seguí desde donde estabas.</p><div className="auth-fields"><label>Email<input type="email" placeholder="vos@ejemplo.com" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Contraseña<input type="password" placeholder="Tu contraseña" required value={password} onChange={e => setPassword(e.target.value)} /></label></div>{error && <p className="auth-error">{error}</p>}<button className="auth-submit" type="submit">Ingresar <span>→</span></button><p className="auth-switch">¿Todavía no tenés cuenta? <a href="/sign-up">Creala gratis</a></p></form></main>
}
