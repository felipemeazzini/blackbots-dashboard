"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAccounts } from "@/hooks/useFacebookData";
import { Shield, Check, X, Trash2 } from "lucide-react";

interface UserAccess {
  id: string;
  user_id: string;
  email: string;
  status: string;
  allowed_accounts: string[] | null;
  is_admin: boolean;
  created_at: string;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: accountsData } = useAccounts();
  const allAccounts = (accountsData?.data || []).filter(
    (a) => Number(a.amount_spent) > 0 && !a.name.includes("Read-Only") && !a.name.includes("Test ")
  );

  useEffect(() => {
    async function loadEmail() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadEmail();
  }, []);

  const authHeaders = { "x-user-email": userEmail };

  const fetchUsers = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch("/api/admin/users", { headers: authHeaders });
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
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) fetchUsers();
  }, [userEmail, fetchUsers]);

  const updateUser = async (id: string, updates: Record<string, unknown>) => {
    setMessage("");
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      await fetchUsers();
      setMessage("Usuario atualizado");
    }
  };

  const deleteUser = async (id: string, userId: string, email: string) => {
    if (!confirm(`Remover ${email} completamente?`)) return;
    await fetch(`/api/admin/users?id=${id}&user_id=${userId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    await fetchUsers();
    setMessage(`${email} removido`);
  };

  const toggleAccount = (user: UserAccess, accountId: string) => {
    const current = user.allowed_accounts || [];
    const updated = current.includes(accountId)
      ? current.filter((a) => a !== accountId)
      : [...current, accountId];
    updateUser(user.id, { allowed_accounts: updated.length > 0 ? updated : null });
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow/10 text-yellow",
    approved: "bg-green/10 text-green",
    denied: "bg-red/10 text-red",
  };
  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    denied: "Negado",
  };

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Gerenciar Usuarios</h2>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 text-sm text-red">{error}</div>
        )}
        {message && (
          <div className="bg-green/10 border border-green/30 rounded-lg px-4 py-3 text-sm text-green">{message}</div>
        )}

        {loading ? (
          <p className="text-text-muted text-sm">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="bg-bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-text-primary font-medium">{u.email}</p>
                    <p className="text-xs text-text-muted">
                      Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      {u.is_admin && <span className="ml-2 text-accent font-medium">Admin</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[u.status] || ""}`}>
                      {statusLabels[u.status] || u.status}
                    </span>
                  </div>
                </div>

                {/* Acoes */}
                <div className="flex items-center gap-2 mb-3">
                  {u.status !== "approved" && (
                    <button
                      onClick={() => updateUser(u.id, { status: "approved" })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green/10 text-green rounded-lg text-xs font-medium hover:bg-green/20 transition-colors"
                    >
                      <Check size={12} /> Aprovar
                    </button>
                  )}
                  {u.status !== "denied" && !u.is_admin && (
                    <button
                      onClick={() => updateUser(u.id, { status: "denied" })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red/10 text-red rounded-lg text-xs font-medium hover:bg-red/20 transition-colors"
                    >
                      <X size={12} /> Negar
                    </button>
                  )}
                  {!u.is_admin && (
                    <button
                      onClick={() => deleteUser(u.id, u.user_id, u.email)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-bg-hover text-text-muted rounded-lg text-xs hover:text-red transition-colors"
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  )}
                </div>

                {/* Contas de anuncio permitidas */}
                {u.status === "approved" && (
                  <div>
                    <p className="text-xs text-text-muted mb-2">
                      Contas de anuncio permitidas {!u.allowed_accounts ? "(todas)" : `(${u.allowed_accounts.length})`}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allAccounts.map((acc) => {
                        const isAllowed = !u.allowed_accounts || u.allowed_accounts.includes(acc.id);
                        return (
                          <button
                            key={acc.id}
                            onClick={() => toggleAccount(u, acc.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              isAllowed
                                ? "bg-accent/15 text-accent border-accent/30"
                                : "bg-bg-hover text-text-muted border-border hover:border-accent/30"
                            }`}
                          >
                            {acc.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      {u.is_admin ? "Admins veem todas as contas" : "Clique para ativar/desativar acesso a cada conta"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
