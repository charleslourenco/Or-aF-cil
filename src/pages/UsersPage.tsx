import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Trash2,
  Edit2,
  RefreshCw,
  Mail,
  User as UserIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useAuth, UserRole } from '@/hooks/use-auth'
import {
  fetchUsuarios,
  deleteUsuario,
  updateUsuarioRole,
  inviteUsuario,
  UsuarioItem,
} from '@/services/usuarios'

export default function UsersPage() {
  const { toast } = useToast()
  const { user: currentUser, profile: currentProfile, isAdmin } = useAuth()

  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal Convidar Usuário
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteNome, setInviteNome] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer')
  const [submittingInvite, setSubmittingInvite] = useState(false)

  // Modal Editar Cargo
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UsuarioItem | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer')
  const [submittingRole, setSubmittingRole] = useState(false)

  // Modal Confirmar Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UsuarioItem | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchUsuarios()
    if (res.error) {
      setError(res.error)
    } else {
      setUsuarios(res.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Submeter convite
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteNome.trim() || !inviteEmail.trim()) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor preencha o nome e o e-mail do usuário.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingInvite(true)
    const res = await inviteUsuario(inviteNome.trim(), inviteEmail.trim(), inviteRole)
    setSubmittingInvite(false)

    if (res.success) {
      toast({
        title: 'Convite enviado!',
        description: `Convite enviado para ${inviteEmail.trim()}`,
      })
      setInviteModalOpen(false)
      setInviteNome('')
      setInviteEmail('')
      setInviteRole('viewer')
      loadData()
    } else {
      toast({
        title: 'Erro ao convidar usuário',
        description: res.error || 'Ocorreu um erro ao processar o convite.',
        variant: 'destructive',
      })
    }
  }

  // Submeter alteração de cargo
  const handleUpdateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setSubmittingRole(true)
    const res = await updateUsuarioRole(selectedUser.id, selectedRole)
    setSubmittingRole(false)

    if (res.success) {
      toast({
        title: 'Cargo atualizado com sucesso!',
        description: `O cargo de ${selectedUser.nome || selectedUser.email} foi alterado para ${getRoleLabel(selectedRole)}.`,
      })
      setEditRoleModalOpen(false)
      setSelectedUser(null)
      loadData()
    } else {
      toast({
        title: 'Erro ao atualizar cargo',
        description: res.error || 'Não foi possível alterar a permissão do usuário.',
        variant: 'destructive',
      })
    }
  }

  // Submeter remoção de usuário
  const handleDeleteSubmit = async () => {
    if (!userToDelete) return

    setSubmittingDelete(true)
    const res = await deleteUsuario(userToDelete.id)
    setSubmittingDelete(false)

    if (res.success) {
      toast({
        title: 'Acesso revogado',
        description: `O usuário ${userToDelete.nome || userToDelete.email} foi removido com sucesso.`,
      })
      setDeleteConfirmOpen(false)
      setUserToDelete(null)
      loadData()
    } else {
      toast({
        title: 'Erro ao remover usuário',
        description: res.error || 'Não foi possível revogar o acesso do usuário.',
        variant: 'destructive',
      })
    }
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 border-0 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrador</span>
          </Badge>
        )
      case 'editor':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 hover:bg-blue-100 border-0 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Editor</span>
          </Badge>
        )
      case 'viewer':
      default:
        return (
          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border-0 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizador</span>
          </Badge>
        )
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'editor':
        return 'Editor'
      case 'viewer':
        return 'Visualizador'
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Gestão de Usuários
              <Badge
                variant="outline"
                className="text-xs font-normal border-slate-300 dark:border-slate-700"
              >
                {usuarios.length} {usuarios.length === 1 ? 'membro' : 'membros'}
              </Badge>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie quem tem acesso ao OrçaFácil e seus níveis de permissão
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => setInviteModalOpen(true)}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Convidar Usuário</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-8 shadow-xs text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Falha ao carregar usuários
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">{error}</p>
          </div>
          <Button
            onClick={loadData}
            variant="outline"
            className="border-slate-300 dark:border-slate-700"
          >
            Tentar novamente
          </Button>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center flex flex-col items-center gap-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Nenhum usuário cadastrado
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Comece adicionando novos administradores, editores ou visualizadores para sua
              marcenaria.
            </p>
          </div>
          <Button
            onClick={() => setInviteModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl mt-2"
          >
            + Convidar primeiro usuário
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table for Desktop */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-semibold text-xs">
                  <th className="py-3.5 px-6">Usuário</th>
                  <th className="py-3.5 px-6">E-mail</th>
                  <th className="py-3.5 px-6">Cargo</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {usuarios.map((u) => {
                  const isCurrent = u.id === currentUser?.id
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-slate-200 dark:border-slate-700">
                            <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
                              {(u.nome || u.email || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {u.nome || 'Sem nome cadastrado'}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Cadastrado em{' '}
                              {u.created_at
                                ? new Date(u.created_at).toLocaleDateString('pt-BR')
                                : 'recente'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-6">{getRoleBadge(u.role)}</td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {u.ativo ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inativo
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedUser(u)
                              setSelectedRole(u.role)
                              setEditRoleModalOpen(true)
                            }}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg"
                            title="Editar cargo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isCurrent}
                            onClick={() => {
                              setUserToDelete(u)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg disabled:opacity-30"
                            title={
                              isCurrent
                                ? 'Você não pode remover sua própria conta'
                                : 'Remover usuário'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Convidar Usuário */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <UserPlus className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Convidar Novo Usuário</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              O usuário receberá um convite para definir sua senha e acessar a plataforma.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold">
                Nome completo
              </Label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="nome"
                  placeholder="Ex: Carlos Silva"
                  value={inviteNome}
                  onChange={(e) => setInviteNome(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-semibold">
                E-mail de acesso
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@marcenaria.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cargo" className="text-xs font-semibold">
                Nível de Acesso (Cargo)
              </Label>
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as UserRole)}>
                <SelectTrigger id="cargo" className="h-10 rounded-xl">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectItem value="admin">
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Administrador
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Acesso total (engenharia, usuários, configurações)
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        Editor
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Pode criar/editar orçamentos e materiais
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Visualizador
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Apenas visualização de orçamentos e relatórios
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingInvite}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-2"
              >
                {submittingInvite ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando convite...</span>
                  </>
                ) : (
                  <span>Enviar Convite</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Cargo */}
      <Dialog open={editRoleModalOpen} onOpenChange={setEditRoleModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
              <Shield className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Editar Cargo do Usuário</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Altere o nível de permissão de{' '}
              <strong>{selectedUser?.nome || selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateRoleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cargo" className="text-xs font-semibold">
                Selecione o novo cargo
              </Label>
              <Select
                value={selectedRole}
                onValueChange={(val) => setSelectedRole(val as UserRole)}
              >
                <SelectTrigger id="edit-cargo" className="h-10 rounded-xl">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectItem value="admin">Administrador (Acesso completo)</SelectItem>
                  <SelectItem value="editor">Editor (Criar/editar orçamentos)</SelectItem>
                  <SelectItem value="viewer">Visualizador (Somente leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditRoleModalOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingRole}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-2"
              >
                {submittingRole ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Confirmar Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-slate-100">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              Remover acesso do usuário?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Tem certeza que deseja remover{' '}
              <strong>{userToDelete?.nome || userToDelete?.email}</strong>? O acesso deste usuário
              ao sistema será imediatamente revogado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-3">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmit}
              disabled={submittingDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
            >
              {submittingDelete ? 'Removendo...' : 'Sim, remover acesso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
