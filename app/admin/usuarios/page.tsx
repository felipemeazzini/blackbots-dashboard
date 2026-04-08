"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, Shield, Mail } from "lucide-react";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        setError("Acesso negado. Apenas administradores.");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch {
      setError("Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (res.ok) {
        setMessage(`Convite enviado para ${inviteEmail}`);
        setInviteEmail("");
        await fetchUsers();
      } else {
        const json = await res.json();
        setError(json.error || "Erro ao enviar convite");
      }
    } catch {
      setError("Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Revogar acesso de ${userEmail}?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchUsers();
        setMessage(`Acesso de ${userEmail} revogado`);
      }
    } catch {
      setError("Erro ao revogar acesso");
    }
  };

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Gerenciar Usuarios</h2>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green/10 border border-green/30 rounded-lg px-4 py-3 text-sm text-green">
            {message}
          </div>
        )}

        {/* Convidar */}
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <Mail size={14} />
            Convidar usuario
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="bg-bg-primary border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent w-72 placeholder:text-text-muted"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-[#1A1A1A] rounded-lg text-sm font-bold hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              <UserPlus size={14} />
              {inviting ? "Enviando..." : "Enviar Convite"}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            O usuario recebera um email com link para definir a senha
          </p>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Email</th>
                <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Criado em</th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Ultimo login</th>
                <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-bg-hover">
                  <td className="px-4 py-3 text-text-primary font-medium">{u.email}</td>
                  <td className="text-center px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      u.confirmed_at ? "bg-green/10 text-green" : "bg-yellow/10 text-yellow"
                    }`}>
                      {u.confirmed_at ? "Ativo" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")
                      : "Nunca"}
                  </td>
                  <td className="text-right px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.id, u.email || "")}
                      className="text-red/60 hover:text-red transition-colors"
                      title="Revogar acesso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-muted">
                    Nenhum usuario cadastrado
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-muted">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
