import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Supplier } from '@/types';
import { saveSupplier } from '@/services/inventoryService';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

interface SupplierFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  editingSupplier: Supplier | null;
}

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  open,
  onOpenChange,
  salonId,
  editingSupplier,
}) => {
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [contactName, setContactName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [state, setState] = useState('SP');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingSupplier) {
      setDocument(editingSupplier.document || '');
      setCompanyName(editingSupplier.companyName || '');
      setTradeName(editingSupplier.tradeName || '');
      setContactName(editingSupplier.contactName || '');
      setWebsite(editingSupplier.website || '');
      setPhone(editingSupplier.phone || '');
      setMobile(editingSupplier.mobile || '');
      setEmail(editingSupplier.email || '');
      setZipCode(editingSupplier.zipCode || '');
      setState(editingSupplier.state || 'SP');
      setCity(editingSupplier.city || '');
      setAddress(editingSupplier.address || '');
      setNumber(editingSupplier.number || '');
      setNeighborhood(editingSupplier.neighborhood || '');
      setComplement(editingSupplier.complement || '');
      setNotes(editingSupplier.notes || '');
    } else {
      setDocument('');
      setCompanyName('');
      setTradeName('');
      setContactName('');
      setWebsite('');
      setPhone('');
      setMobile('');
      setEmail('');
      setZipCode('');
      setState('SP');
      setCity('');
      setAddress('');
      setNumber('');
      setNeighborhood('');
      setComplement('');
      setNotes('');
    }
  }, [open, editingSupplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeName.trim()) {
      toast.error('Informe ao menos o Nome Fantasia do fornecedor.');
      return;
    }

    setSaving(true);
    try {
      await saveSupplier(
        salonId,
        {
          tradeName: tradeName.trim(),
          companyName: companyName.trim(),
          document: document.trim(),
          contactName: contactName.trim(),
          website: website.trim(),
          phone: phone.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          zipCode: zipCode.trim(),
          state: state.trim(),
          city: city.trim(),
          address: address.trim(),
          number: number.trim(),
          neighborhood: neighborhood.trim(),
          complement: complement.trim(),
          notes: notes.trim(),
          isActive: true,
        },
        editingSupplier?.id
      );

      toast.success(
        editingSupplier
          ? `Fornecedor "${tradeName.trim()}" atualizado.`
          : `Fornecedor "${tradeName.trim()}" cadastrado.`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar fornecedor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E2DC] shrink-0">
          <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#8A6D36]" />
            {editingSupplier ? `Editar Fornecedor: ${editingSupplier.tradeName}` : 'Cadastro de Fornecedor'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B6B]">
            Dados fiscais, contato comercial e endereço para pedidos de compra e importação NF-e.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">CNPJ / CPF</Label>
              <Input
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Razão Social</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Razão Social Ltda"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Nome Fantasia *</Label>
              <Input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Essenza Distribuidora"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Responsável / Representante</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do vendedor ou contato"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Site / Catálogo</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Telefone Fixo</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 3000-0000"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Celular / WhatsApp</Label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">E-mail Comercial</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pedidos@fornecedor.com.br"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E5E2DC]">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">CEP</Label>
              <Input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="00000-000"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Estado (UF)</Label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
              >
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Cidade</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Sorocaba"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Endereço</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua / Avenida"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Número</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Nº"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Bairro</Label>
              <Input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Complemento</Label>
              <Input
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Sala, galpão, bloco..."
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Observação Comercial</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Prazo de entrega, pedido mínimo, condições..."
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 border-[#E5E2DC] text-[#171717] rounded-lg text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs font-semibold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Salvar Fornecedor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
