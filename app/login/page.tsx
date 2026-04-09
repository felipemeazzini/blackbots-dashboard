"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pendingApproval, setPendingApproval] = useState(false);
  const [denied, setDenied] = useState(false);

  const checkAccess = async (userId: string, userEmail: string) => {
    // Check user_access status
    const res = await fetch("/api/user-access", {
      headers: { "x-user-id": userId },
    });
    const json = await res.json();

    if (!json.data) {
      // First login — create pending access
      await fetch("/api/user-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email: userEmail }),
      });
      setPendingApproval(true);
      return;
    }

    if (json.data.status === "approved") {
      window.location.href = "/dashboard";
      return;
    }

    if (json.data.status === "denied") {
      setDenied(true);
      return;
    }

    // pending
    setPendingApproval(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setPendingApproval(false);
    setDenied(false);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("As senhas nao coincidem");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Senha deve ter no minimo 6 caracteres");
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.user) {
          await checkAccess(data.user.id, email);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError("Email ou senha incorretos");
          return;
        }
        if (data.user) {
          await checkAccess(data.user.id, email);
        }
      }
    } catch {
      setError("Erro ao conectar");
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <div className="my-6">
            <div className="w-16 h-16 rounded-full bg-[#F5A623]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏳</span>
            </div>
            <h2 className="text-lg font-semibold text-[#F5F5F5] mb-2">Aguardando aprovacao</h2>
            <p className="text-sm text-[#707070]">
              Seu cadastro foi recebido. O administrador precisa aprovar seu acesso.
            </p>
          </div>
          <button
            onClick={() => { setPendingApproval(false); setMode("login"); }}
            className="text-xs text-[#F5A623] hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <div className="my-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚫</span>
            </div>
            <h2 className="text-lg font-semibold text-[#EF4444] mb-2">Acesso negado</h2>
            <p className="text-sm text-[#707070]">
              Seu acesso foi negado pelo administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#F5F5F5]">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <p className="text-sm text-[#707070] mt-1">Marketing Dashboard</p>
        </div>

        {/* Toggle Login/Signup */}
        <div className="flex mb-6 bg-[#1A1A1A] rounded-lg p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login" ? "bg-[#F5A623] text-[#1A1A1A]" : "text-[#707070]"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "signup" ? "bg-[#F5A623] text-[#1A1A1A]" : "text-[#707070]"
            }`}
          >
            Criar Conta
          </button>
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
              placeholder={mode === "signup" ? "Minimo 6 caracteres" : "Digite a senha"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-xs text-[#707070] mb-1.5">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
              />
            </div>
          )}

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password || (mode === "signup" && !confirmPassword)}
            className="w-full bg-[#F5A623] text-[#1A1A1A] rounded-lg py-2.5 text-sm font-bold hover:bg-[#F5A623]/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar Conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
