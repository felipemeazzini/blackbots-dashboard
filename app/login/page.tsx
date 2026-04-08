"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const router = useRouter();

  // Check if user arrived via invite link (has hash params from Supabase)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("type=invite"))) {
      // Supabase puts tokens in the hash fragment for invite links
      const supabase = createClient();
      setIsInvite(true);
      // Give Supabase client time to pick up the hash tokens
      const checkSession = async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          window.location.href = "/auth/set-password";
        }
      };
      checkSession();
      setTimeout(checkSession, 1500);
      setTimeout(checkSession, 3000);
    }

    // Check for token_hash in query params
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && type) {
      setIsInvite(true);
      const supabase = createClient();
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "invite" }).then(({ error: err }: { error: Error | null }) => {
        if (!err) {
          window.location.href = "/auth/set-password";
        } else {
          setError("Link expirado ou invalido. Solicite um novo convite.");
          setIsInvite(false);
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Email ou senha incorretos");
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Erro ao conectar");
    } finally {
      setLoading(false);
    }
  };

  if (isInvite) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <p className="text-sm text-[#707070]">Processando convite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F5F5F5]">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <p className="text-sm text-[#707070] mt-1">Marketing Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-[#F5A623] text-[#1A1A1A] rounded-lg py-2.5 text-sm font-bold hover:bg-[#F5A623]/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-[#707070] mt-4">
          Acesso apenas para convidados
        </p>
      </div>
    </div>
  );
}
