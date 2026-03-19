import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  increment,
  query
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Scale,
  Loader2,
  ArrowRight,
  Shield,
  PlusCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Vote,
  Lightbulb,
  AlertCircle
} from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE ENTORNO
// ==========================================
// Nota: En un proyecto local, estas variables vendrían de un archivo .env
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "REEMPLAZAR_CON_TU_API_KEY",
      authDomain: "TU_PROYECTO.firebaseapp.com",
      projectId: "TU_PROYECTO_ID",
      storageBucket: "TU_PROYECTO.appspot.com",
      messagingSenderId: "TU_ID",
      appId: "TU_APP_ID"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'democracia-directa-cl';
const geminiApiKey = ""; // La API Key se maneja internamente en el entorno de ejecución

export default function App() {
  const [user, setUser] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [currentPair, setCurrentPair] = useState([]);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  // Autenticación inicial
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Error Auth:", err);
        setError("Error de conexión. Revisa la configuración de Firebase.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Carga de datos desde Firestore
  useEffect(() => {
    if (!user) return;

    // Ruta: /artifacts/{appId}/public/data/proposals
    const proposalsCol = collection(db, 'artifacts', appId, 'public', 'data', 'proposals');
    const q = query(proposalsCol);

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setProposals(docs);
        setLoading(false);
      }, 
      (err) => {
        console.error("Error Firestore:", err);
        setError("No se pudieron cargar las propuestas.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Lógica de pares para votación
  useEffect(() => {
    if (proposals.length >= 2 && currentPair.length === 0 && view === 'vote') {
      const shuffled = [...proposals].sort(() => 0.5 - Math.random());
      setCurrentPair(shuffled.slice(0, 2));
    }
  }, [proposals, currentPair, view]);

  const handleVote = async (winnerId) => {
    if (!user) return;
    const winnerRef = doc(db, 'artifacts', appId, 'public', 'data', 'proposals', winnerId);
    const loserId = currentPair.find(p => p.id !== winnerId)?.id;
    const loserRef = loserId ? doc(db, 'artifacts', appId, 'public', 'data', 'proposals', loserId) : null;
    
    try {
      await updateDoc(winnerRef, { 
        votes: increment(1), 
        showCount: increment(1) 
      });
      if (loserRef) {
        await updateDoc(loserRef, { 
          showCount: increment(1) 
        });
      }
      setCurrentPair([]);
    } catch (err) {
      console.error("Voto fallido:", err);
      setError("No pudimos registrar tu voto.");
    }
  };

  const submitIdea = async () => {
    if (!newIdea.trim() || !user) return;
    setSubmitting(true);
    setError(null);

    const systemPrompt = "Eres un redactor legislativo. Resume la idea del usuario en un JSON: { 'title': 'Título breve', 'desc': 'Descripción formal' }. Máximo 25 palabras en total.";
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Idea: ${newIdea}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const result = await response.json();
      const cleanData = JSON.parse(result.candidates[0].content.parts[0].text);
      
      const proposalsCol = collection(db, 'artifacts', appId, 'public', 'data', 'proposals');
      const newId = crypto.randomUUID();
      
      await setDoc(doc(proposalsCol, newId), {
        title: cleanData.title,
        desc: cleanData.desc,
        votes: 0,
        showCount: 0,
        createdAt: Date.now(),
        creator: user.uid
      });

      setNewIdea("");
      setView('ranking');
    } catch (err) {
      setError("Error al procesar la idea con Inteligencia Artificial.");
    } finally {
      setSubmitting(false);
    }
  };

  const sortedRanking = useMemo(() => {
    return [...proposals].sort((a, b) => {
      const rateA = a.showCount > 0 ? (a.votes / a.showCount) : 0;
      const rateB = b.showCount > 0 ? (b.votes / b.showCount) : 0;
      return rateB - rateA;
    });
  }, [proposals]);

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <Scale className="absolute inset-0 m-auto text-indigo-600 w-6 h-6" />
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 tracking-widest">Sincronizando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-slate-900 p-1.5 rounded-lg text-white">
              <Scale size={18} />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase">Democracia<span className="text-indigo-600">Directa</span></span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setView('vote')} className={`text-[10px] font-bold uppercase tracking-wider ${view === 'vote' ? 'text-indigo-600' : 'text-slate-400'}`}>Votar</button>
            <button onClick={() => setView('ranking')} className={`text-[10px] font-bold uppercase tracking-wider ${view === 'ranking' ? 'text-indigo-600' : 'text-slate-400'}`}>Ranking</button>
            <button onClick={() => setView('propose')} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider">Proponer</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
        {view === 'home' && (
          <div className="text-center space-y-10 animate-in fade-in duration-700">
            <h1 className="text-6xl md:text-[7rem] font-black tracking-tighter leading-[0.85] text-slate-900">
              Chile decide <br/>
              <span className="text-indigo-600 italic">sin filtros.</span>
            </h1>
            <p className="text-xl text-slate-500 max-w-xl mx-auto font-medium">
              Vota y prioriza el futuro del país de forma directa.
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setView('vote')} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl hover:scale-105 transition-all">
                EMPEZAR A VOTAR
              </button>
            </div>
          </div>
        )}

        {view === 'vote' && (
          <div className="space-y-12 text-center animate-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase">¿Cuál es prioridad?</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {currentPair.length > 0 ? currentPair.map(p => (
                <button key={p.id} onClick={() => handleVote(p.id)} className="bg-white border border-slate-100 p-12 rounded-[3rem] text-left hover:border-indigo-600 shadow-sm transition-all flex flex-col justify-between min-h-[300px]">
                  <div>
                    <h3 className="text-2xl font-black uppercase mb-4 leading-tight">{p.title}</h3>
                    <p className="text-slate-400 font-medium">{p.desc}</p>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mt-6">Seleccionar propuesta</div>
                </button>
              )) : (
                <div className="col-span-2 py-20 text-slate-400 italic font-bold uppercase tracking-widest">
                  Cargando propuestas ciudadanas...
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'ranking' && (
          <div className="space-y-6">
            <h2 className="text-4xl font-black tracking-tighter mb-10">Ranking <span className="text-indigo-600 italic">País</span></h2>
            {sortedRanking.map((p, i) => (
              <div key={p.id} className="bg-white border border-slate-100 p-6 rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                  <span className="text-3xl font-black text-slate-100 italic">#{i+1}</span>
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-slate-800">{p.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.votes} Votos</p>
                  </div>
                </div>
                <div className="text-indigo-600 font-black text-xl italic">
                  {p.showCount > 0 ? Math.round((p.votes / p.showCount) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'propose' && (
          <div className="max-w-xl mx-auto space-y-8 text-center">
            <h2 className="text-4xl font-black tracking-tighter italic">Crea una propuesta</h2>
            <textarea 
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="¿Qué mejorarías en Chile?"
              className="w-full h-44 bg-white border border-slate-100 rounded-[2rem] p-8 text-lg font-medium focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm"
            />
            <button 
              disabled={submitting || !newIdea.trim()}
              onClick={submitIdea}
              className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <><Sparkles size={20} /> GENERAR CON IA</>}
            </button>
          </div>
        )}
      </main>

      <footer className="py-12 text-center border-t border-slate-100 mt-auto">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">DemocraciaDirecta.cl — 2024</p>
      </footer>
    </div>
  );
}
