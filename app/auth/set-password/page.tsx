"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Senha deve ter no minimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao coincidem");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Erro ao definir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F5F5F5]">
            <span className="text-[#F5A623]">Black</span>Bots
          </h1>
          <p className="text-sm text-[#707070] mt-1">Defina sua senha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1.5">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              autoFocus
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1.5">Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#F5A623] placeholder:text-[#707070]"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full bg-[#F5A623] text-[#1A1A1A] rounded-lg py-2.5 text-sm font-bold hover:bg-[#F5A623]/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Definir Senha e Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
