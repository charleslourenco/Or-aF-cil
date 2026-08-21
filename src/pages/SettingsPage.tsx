import React, { useEffect, useState, useRef } from 'react'
import {
  Building2,
  FileText,
  MapPin,
  Share2,
  Upload,
  Image as ImageIcon,
  Save,
  Loader2,
  CheckCircle2,
  Trash2,
  Globe,
  Instagram,
  Facebook,
  Mail,
  Phone,
  Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  fetchPerfilEmpresa,
  upsertPerfilEmpresa,
  uploadEmpresaLogo,
  type PerfilEmpresa,
} from '@/services/empresa'

// Lista oficial dos estados brasileiros (UFs)
const ESTADOS_BRASIL = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
]

// Máscaras de formatação
function maskCNPJ(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function maskCEP(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | undefined>(undefined)

  // Card 1: Identidade
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewLogo, setPreviewLogo] = useState<string>('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')

  // Card 2: Documentos
  const [cnpj, setCnpj] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')

  // Card 3: Endereço
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cep, setCep] = useState('')

  // Card 4: Contato & Redes Sociais
  const [telefone, setTelefone] = useState('')
  const [emailComercial, setEmailComercial] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [site, setSite] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Carrega dados iniciais do Supabase
  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      const { data, error } = await fetchPerfilEmpresa()
      if (!active) return

      if (error) {
        toast({
          title: 'Erro ao carregar dados da empresa',
          description: error,
          variant: 'destructive',
        })
      } else if (data) {
        setRecordId(data.id)
        setLogoUrl(data.logo_url || '')
        setPreviewLogo(data.logo_url || '')
        setRazaoSocial(data.razao_social || '')
        setNomeFantasia(data.nome_fantasia || '')
        setCnpj(data.cnpj ? maskCNPJ(data.cnpj) : '')
        setInscricaoEstadual(data.inscricao_estadual || '')
        setLogradouro(data.logradouro || '')
        setNumero(data.numero || '')
        setComplemento(data.complemento || '')
        setBairro(data.bairro || '')
        setCidade(data.cidade || '')
        setEstado(data.estado || '')
        setCep(data.cep ? maskCEP(data.cep) : '')
        setTelefone(data.telefone ? maskPhone(data.telefone) : '')
        setEmailComercial(data.email_comercial || '')
        setInstagram(data.instagram || '')
        setFacebook(data.facebook || '')
        setSite(data.site || '')
      }
      setLoading(false)
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  // Manipulador de arquivo de logo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem (PNG, JPG, SVG, WebP).',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreviewLogo(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setSelectedFile(null)
    setPreviewLogo('')
    setLogoUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Ação de salvar perfil da empresa
  const handleSave = async () => {
    setSaving(true)
    try {
      let finalLogoUrl = logoUrl

      // Se há um novo arquivo selecionado, faz upload para o Supabase Storage
      if (selectedFile) {
        const { publicUrl, error: uploadErr } = await uploadEmpresaLogo(selectedFile)
        if (uploadErr) {
          toast({
            title: 'Erro no upload da logomarca',
            description: uploadErr,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
        if (publicUrl) {
          finalLogoUrl = publicUrl
          setLogoUrl(publicUrl)
        }
      }

      // Se o usuário removeu a logo explicitamente
      if (!previewLogo && !selectedFile) {
        finalLogoUrl = ''
      }

      const payload: Partial<PerfilEmpresa> = {
        ...(recordId ? { id: recordId } : {}),
        logo_url: finalLogoUrl || null,
        razao_social: razaoSocial.trim() || null,
        nome_fantasia: nomeFantasia.trim() || null,
        cnpj: cnpj.trim() || null,
        inscricao_estadual: inscricaoEstadual.trim() || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        estado: estado.trim() || null,
        cep: cep.trim() || null,
        telefone: telefone.trim() || null,
        email_comercial: emailComercial.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        site: site.trim() || null,
      }

      const { data, error } = await upsertPerfilEmpresa(payload)

      if (error) {
        toast({
          title: 'Erro ao salvar dados',
          description: error,
          variant: 'destructive',
        })
      } else {
        if (data?.id) {
          setRecordId(data.id)
        }
        setSelectedFile(null)
        toast({
          title: 'Dados da empresa salvos com sucesso!',
          description: 'As informações e a logomarca foram atualizadas no sistema.',
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar informações'
      toast({
        title: 'Erro inesperado',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Cabeçalho da página */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold mb-1">
          <Building2 className="w-3.5 h-3.5 text-slate-700" />
          <span>Configurações Corporativas</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Cadastro da Empresa
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-3xl leading-relaxed">
          Mantenha os dados cadastrais, endereço e identidade visual da marcenaria sempre
          atualizados para emissão de orçamentos e relatórios.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-slate-700 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Carregando dados da empresa...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ============================================================ */}
          {/* CARD 1: IDENTIDADE DA EMPRESA */}
          {/* ============================================================ */}
          <section
            aria-labelledby="identidade-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="identidade-heading"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  Identidade da Empresa
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Logomarca e nomes comerciais que identificam seu negócio
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Upload de Logomarca */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-700" />
                  Logomarca da Empresa
                </Label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  {previewLogo ? (
                    <div className="relative group w-28 h-28 rounded-xl border border-slate-200 bg-white p-2 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                      <img
                        src={previewLogo}
                        alt="Logomarca da Empresa"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 flex flex-col items-center justify-center text-slate-400 shrink-0 text-center p-2">
                      <ImageIcon className="w-8 h-8 stroke-[1.5] mb-1 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500">Sem Logomarca</span>
                    </div>
                  )}

                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 px-4 rounded-xl border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-700" />
                        {previewLogo ? 'Alterar Logomarca' : 'Selecionar Logomarca'}
                      </Button>

                      {previewLogo && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleRemoveLogo}
                          className="h-9 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Formatos recomendados: PNG, JPG ou SVG com fundo transparente. Resolução
                      mínima: 300x300px.
                    </p>
                  </div>
                </div>
              </div>

              {/* Razão Social e Nome Fantasia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="razao_social"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Razão Social
                  </Label>
                  <Input
                    id="razao_social"
                    placeholder="Ex.: Silva & Santos Móveis Planejados LTDA"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="nome_fantasia"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Nome Fantasia
                  </Label>
                  <Input
                    id="nome_fantasia"
                    placeholder="Ex.: Arte & Madeira Marcenaria"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* CARD 2: DOCUMENTOS */}
          {/* ============================================================ */}
          <section
            aria-labelledby="documentos-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="documentos-heading"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  Documentos Fiscais
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Identificadores fiscais e estaduais da empresa
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="cnpj"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                >
                  <Hash className="w-3.5 h-3.5 text-slate-700" />
                  CNPJ
                </Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  maxLength={18}
                  onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                  className="h-11 rounded-xl text-sm font-mono border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="inscricao_estadual"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-700" />
                  Inscrição Estadual (IE)
                </Label>
                <Input
                  id="inscricao_estadual"
                  placeholder="Ex.: 123.456.789.110 ou Isento"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  className="h-11 rounded-xl text-sm font-mono border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                />
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* CARD 3: ENDEREÇO */}
          {/* ============================================================ */}
          <section
            aria-labelledby="endereco-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 id="endereco-heading" className="text-base sm:text-lg font-bold text-slate-900">
                  Endereço do Estabelecimento
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Localização da fábrica, oficina ou showroom
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Linha 1: Logradouro, Número, Complemento */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6 space-y-1.5">
                  <Label
                    htmlFor="logradouro"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Logradouro (Rua / Av.)
                  </Label>
                  <Input
                    id="logradouro"
                    placeholder="Ex.: Av. dos Marceneiros"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label
                    htmlFor="numero"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Número
                  </Label>
                  <Input
                    id="numero"
                    placeholder="Ex.: 1500"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <Label
                    htmlFor="complemento"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Complemento
                  </Label>
                  <Input
                    id="complemento"
                    placeholder="Ex.: Galpão 3, Sala 12"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>
              </div>

              {/* Linha 2: Bairro, Cidade, Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5 space-y-1.5">
                  <Label
                    htmlFor="bairro"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Bairro
                  </Label>
                  <Input
                    id="bairro"
                    placeholder="Ex.: Distrito Industrial"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <Label
                    htmlFor="cidade"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Cidade
                  </Label>
                  <Input
                    id="cidade"
                    placeholder="Ex.: São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1.5">
                  <Label
                    htmlFor="estado"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    Estado (UF)
                  </Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger id="estado" className="h-11 rounded-xl text-sm border-slate-300">
                      <SelectValue placeholder="Selecione o Estado" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-60">
                      {ESTADOS_BRASIL.map((item) => (
                        <SelectItem key={item.uf} value={item.uf}>
                          {item.uf} - {item.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linha 3: CEP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cep"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide"
                  >
                    CEP
                  </Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={cep}
                    maxLength={9}
                    onChange={(e) => setCep(maskCEP(e.target.value))}
                    className="h-11 rounded-xl text-sm font-mono border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* CARD 4: CONTATO E REDES SOCIAIS */}
          {/* ============================================================ */}
          <section
            aria-labelledby="contato-heading"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="contato-heading" className="text-base sm:text-lg font-bold text-slate-900">
                  Contato e Redes Sociais
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Canais de atendimento, redes e links de divulgação
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="telefone"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-700" />
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="telefone"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    maxLength={15}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="email_comercial"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-700" />
                    E-mail Comercial
                  </Label>
                  <Input
                    id="email_comercial"
                    type="email"
                    placeholder="contato@marcenaria.com.br"
                    value={emailComercial}
                    onChange={(e) => setEmailComercial(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="instagram"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                  >
                    <Instagram className="w-3.5 h-3.5 text-slate-700" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="@marcenaria"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="facebook"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                  >
                    <Facebook className="w-3.5 h-3.5 text-slate-700" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    placeholder="facebook.com/marcenaria"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="site"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-700" />
                    Site Oficial (URL)
                  </Label>
                  <Input
                    id="site"
                    type="url"
                    placeholder="https://www.marcenaria.com.br"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* BOTÃO SALVAR DADOS DA EMPRESA */}
          {/* ============================================================ */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto h-12 px-8 bg-slate-700 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-slate-700/25 transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Dados da Empresa...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Dados da Empresa</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
