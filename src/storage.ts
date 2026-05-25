/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from "./lib/supabase";
import {
  IARecord,
  StatusAuditoria,
  StatusUso,
  Criticidade,
  ClassificacaoRisco,
  TiposIA,
  ObjetivosIA,
  EtapaProcesso,
  NaturezaUso,
  GrauAutonomia,
  RiscoResidual,
  UserProfile
} from "./types";

const STORAGE_KEY = "cedro_ia_inventory";

export const getProfiles = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
};

export const getGlobalRecords = async (): Promise<IARecord[]> => {
  try {
    console.log('🌐 Buscando todos os registros públicos no Supabase (ID de Protocolo Global)...');
    const { data, error } = await supabase
      .from('ia_records')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    
    if (data && data.length > 0) {
      return data
        .filter(item => item.id !== 'METADATA-SECTORS')
        .map(item => {
          let record: IARecord;
        if (item.data) {
          record = item.data as IARecord;
          record.id = item.id;
          record.unidadeSetor = item.unidade_setor || record.unidadeSetor || '';
          record.ownerId = item.owner_id || record.ownerId || '';
        } else {
          record = {
            id: item.id,
            unidadeSetor: item.unidade_setor || '',
            ownerId: item.owner_id || '',
            nomeFerramenta: item.nome_ferramenta || '',
          } as any as IARecord;
        }
        return record;
      });
    }
    return [];
  } catch (error) {
    console.error('💥 Erro ao buscar registros globais:', error);
    return [];
  }
};

export const getRecords = async (userId?: string, isAdmin?: boolean, userSector?: string): Promise<IARecord[]> => {
  let finalIsAdmin = isAdmin;
  try {
    if (userId && !finalIsAdmin) {
      try {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (!profErr && prof && prof.role?.toLowerCase().trim() === 'admin') {
          console.log('👑 Role admin verificada diretamente no banco!');
          finalIsAdmin = true;
        }
      } catch (e) {
        console.warn('Erro ao checar admin no banco em getRecords:', e);
      }
    }

    console.log('🔍 Buscando registros no Supabase...', { userId, isAdmin: finalIsAdmin, userSector });

    let query = supabase
      .from('ia_records')
      .select('*');

    if (!finalIsAdmin) {
      console.log('🛡️ Aplicando filtros de segurança para usuário comum (Setor OU Propriedade)');
      const sectorStr = (userSector || '').trim();
      if (sectorStr && userId) {
        // Exibimos registros que pertencem ao setor do usuário OU que foram criados por ele (owner_id)
        query = query.or(`unidade_setor.ilike."${sectorStr}",owner_id.eq.${userId}`);
      } else if (sectorStr) {
        query = query.ilike('unidade_setor', sectorStr);
      } else if (userId) {
        query = query.eq('owner_id', userId);
      } else {
        query = query.eq('unidade_setor', '---SECTOR-BLANK-NO-ACCESS---');
      }
    }

    let result = await query.order('id', { ascending: true });
    let data = result.data;
    let error = result.error;
    let status = result.status;

    // Se falhar por falta da coluna 'owner_id', fazemos fallback seguro buscando todos e filtrando em memória
    if (error && (error.code === '42703' || error.message?.includes('owner_id') || status === 400 || error.code === 'PGRST100')) {
      console.warn('⚠️ Coluna owner_id não existe. Buscando todos os registros públicos e filtrando na memória...');
      const fallbackResult = await supabase
        .from('ia_records')
        .select('*')
        .order('id', { ascending: true });
      data = fallbackResult.data;
      error = fallbackResult.error;
      status = fallbackResult.status;
    }

    if (error) {
      console.error('❌ Erro ao buscar no Supabase:', error, 'Status:', status);
      throw error;
    }

    let resultRecords: IARecord[] = [];

    if (data && data.length > 0) {
      console.log(`✅ ${data.length} registros encontrados no Supabase.`);
      const filteredData = data.filter(item => item.id !== 'METADATA-SECTORS');
      const mappedData = filteredData.map(item => {
        let record: IARecord;
        
        if (item.data) {
          record = item.data as IARecord;
          record.id = item.id; // Sync ID
          // Ensure unity sector is populated from raw database column fallback
          record.unidadeSetor = item.unidade_setor || record.unidadeSetor || (record as any).unidade_setor || '';
          record.ownerId = item.owner_id || record.ownerId || (record as any).owner_id || '';
        } else {
          record = {
            id: item.id,
            unidadeSetor: item.unidade_setor || '',
            responsavelPreenchimento: item.responsavel_preenchimento || '',
            cargo: item.cargo || '',
            dataRegistro: item.data_registro || new Date().toISOString().split('T')[0],
            utilizaIA: item.utiliza_ia || 'Sim',
            nomeFerramenta: item.nome_ferramenta || 'IA sem nome',
            fornecedor: item.fornecedor || 'Desconhecido',
            statusUso: (item.status_uso as StatusUso) || StatusUso.EM_AVALIACAO,
            createdAt: item.created_at || new Date().toISOString(),
            updatedAt: item.updated_at || new Date().toISOString(),
            ownerId: item.owner_id || '',
            historico: []
          } as any as IARecord;
        }

        // Ensure statusAuditoria is never undefined for filtering purposes
        if (!record.statusAuditoria) {
          record.statusAuditoria = StatusAuditoria.PENDENTE;
        }

        return record;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedData));
      resultRecords = mappedData;
    } else {
      console.log('ℹ️ Supabase retornou 0 registros. Verificando fallback...');

      const localDataStr = localStorage.getItem(STORAGE_KEY);
      if (localDataStr) {
        const localRecords: IARecord[] = JSON.parse(localDataStr);
        const cleanLocalRecords = localRecords.filter(r => r.id !== "METADATA-SECTORS" && !["IA-CEDRO-0001", "IA-CEDRO-0002", "IA-CEDRO-0003", "IA-CEDRO-0004", "IA-CEDRO-0005", "IA-CEDRO-0006"].includes(r.id));
        if (cleanLocalRecords.length > 0) {
          console.log('📦 Carregando do LocalStorage:', cleanLocalRecords.length);
          resultRecords = cleanLocalRecords;
        } else {
          resultRecords = [];
        }
      } else {
        resultRecords = [];
      }
    }

    if (!finalIsAdmin) {
      const activeSector = (userSector || '').trim().toLowerCase();
      console.log(`🛡️ Filtrando registros para o setor do usuário: ${activeSector} ou criados pelo próprio usuário`);
      resultRecords = resultRecords.filter(r => {
        const rSector = (r.unidadeSetor || (r as any).unidade_setor || '').trim().toLowerCase();
        const rOwner = r.ownerId || (r as any).owner_id || '';
        const isOwner = userId && String(rOwner) === String(userId);
        const matchesSector = activeSector && rSector === activeSector;
        return matchesSector || isOwner;
      });
    }

    return resultRecords;
  } catch (error) {
    console.error('💥 Erro crítico no getRecords:', error);
    let fallbackRecords: IARecord[] = [];
    const data = localStorage.getItem(STORAGE_KEY);
    try {
      if (data) {
        const parsed = JSON.parse(data);
        fallbackRecords = parsed.filter((r: any) => r.id !== "METADATA-SECTORS" && !["IA-CEDRO-0001", "IA-CEDRO-0002", "IA-CEDRO-0003", "IA-CEDRO-0004", "IA-CEDRO-0005", "IA-CEDRO-0006"].includes(r.id));
      } else {
        fallbackRecords = [];
      }
    } catch (e) {
      fallbackRecords = [];
    }
    
    if (!finalIsAdmin) {
      const activeSector = (userSector || '').trim().toLowerCase();
      fallbackRecords = fallbackRecords.filter(r => 
        r.unidadeSetor && r.unidadeSetor.trim().toLowerCase() === activeSector
      );
    }
    return fallbackRecords;
  }
};

export const addRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  let finalIsAdmin = isAdmin;
  try {
    if (userId && !finalIsAdmin) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (prof?.role?.toLowerCase().trim() === 'admin') {
          finalIsAdmin = true;
        }
      } catch (e) {}
    }

    console.log('☁️ Tentando salvar registro no Supabase:', record.id, { isAdmin: finalIsAdmin });
    
    // Determinando o status final: 
    // Pendente, Aprovado ou Negado
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    const resolvedOwnerId = userId || record.ownerId || (record as any).owner_id || null;
    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId 
    };

    const payload: any = { 
      id: record.id, 
      data: recordWithStatus,
      updated_at: new Date().toISOString(),
      unidade_setor: record.unidadeSetor || '',
      responsavel_preenchimento: record.responsavelPreenchimento || '',
      nome_ferramenta: record.nomeFerramenta || ''
    };

    let upsertErr;
    try {
      const { error } = await supabase
        .from('ia_records')
        .upsert({ 
          ...payload,
          owner_id: resolvedOwnerId
        });
      upsertErr = error;
    } catch (e: any) {
      upsertErr = e;
    }

    if (upsertErr) {
      const errMsg = (upsertErr.message || '').toLowerCase();
      const isMissingColumn = upsertErr.code === 'PGRST204' || upsertErr.code === '42703' || errMsg.includes('owner_id') || errMsg.includes('schema cache');
      if (isMissingColumn) {
        console.warn('⚠️ Coluna owner_id não existe no banco. Salvando registro sem essa coluna...', upsertErr);
        const { error: retryError } = await supabase
          .from('ia_records')
          .upsert(payload);
        if (retryError) {
          console.error('❌ Erro no salvamento de fallback (sem owner_id):', retryError);
          throw retryError;
        }
      } else {
        console.error('❌ Erro detalhado do Supabase (com owner_id):', upsertErr);
        throw upsertErr;
      }
    }
    console.log('✅ Registro salvo com sucesso no Supabase!');
  } catch (error: any) {
    console.error('Error adding to Supabase:', error);
    throw error; 
  }
  
  // Local fallback
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const records: IARecord[] = localData ? JSON.parse(localData) : [];
    const index = records.findIndex(r => r.id === record.id);
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    const resolvedOwnerId = userId || record.ownerId || (record as any).owner_id || null;
    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId
    };
    
    if (index === -1) records.push(recordWithStatus);
    else records[index] = recordWithStatus;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Local sync failed:', e);
  }
};

export const saveRecordsToSupabase = async (records: IARecord[], userId?: string, isAdmin?: boolean) => {
  console.log(`Syncing ${records.length} records to Supabase...`);
  for (const record of records) {
    await addRecord(record, userId, isAdmin);
  }
};

export const updateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin); // Upsert handles update
};

export const addOrUpdateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin);
};

export const deleteRecord = async (id: string) => {
  try {
    const { error } = await supabase
      .from('ia_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    // If Supabase failed, we still try local delete but we should probably inform the UI
    // if it was specifically a network/auth error. 
    // However, we'll throw here to let App.tsx know if it should rollback the optimistic update
    throw error;
  }

  // Local sync
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const records = JSON.parse(localData);
      const filtered = records.filter((r: any) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Error updating localStorage:', e);
  }
};

export const checkSupabaseStatus = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('ia_records').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
};

export const updateUserProfile = async (profileId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    console.log(`📡 Enviando atualização para perfil ${profileId}:`, updates);
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId)
      .select();

    if (error) {
      // Ignore schema cache errors for last_seen specifically for a smoother onboarding
      if (error.code === 'PGRST204' && updates.hasOwnProperty('last_seen')) {
        console.warn('⚠️ Coluna "last_seen" não encontrada. Execute o SQL em SUPABASE_SETUP.md para habilitar status online.');
        return null;
      }
      console.error('❌ Erro Supabase ao atualizar perfil:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhuma linha foi atualizada. Verifique se o ID existe e se você tem permissão RLS.');
      return null;
    }

    console.log('✅ Perfil atualizado com sucesso:', data[0]);
    return data[0] as UserProfile;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

export const generateId = (records: IARecord[]): string => {
  if (records.length === 0) return "IA-CEDRO-0001";
  
  // Extrair números dos IDs existentes e pegar o maior
  const ids = records.map(r => {
    const match = r.id.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  });
  
  const maxId = Math.max(...ids);
  return `IA-CEDRO-${(maxId + 1).toString().padStart(4, "0")}`;
};

export const DEFAULT_SECTORS = [
  "NIT",
  "TI",
  "Marketing",
  "Administrativo",
  "Jurídico",
  "Direção Técnica",
  "Qualidade",
  "Atendimento / Recepção",
  "Laboratório de Patologia",
  "Laboratório Central"
];

const SECTORS_STORAGE_KEY = "cedro_custom_sectors";

export const getSectors = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('ia_records')
      .select('data')
      .eq('id', 'METADATA-SECTORS')
      .maybeSingle();

    if (!error && data && data.data && Array.isArray((data.data as any).sectors)) {
      const dbSectors = (data.data as any).sectors as string[];
      localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(dbSectors));
      return dbSectors;
    }
  } catch (error) {
    console.error('Erro ao buscar setores do Supabase:', error);
  }

  // Fallback 1: LocalStorage
  try {
    const local = localStorage.getItem(SECTORS_STORAGE_KEY);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {
    console.error('Erro ao ler setores do localStorage:', e);
  }

  // Fallback 2: Padrão
  return DEFAULT_SECTORS;
};

export const saveSectors = async (sectors: string[]): Promise<boolean> => {
  try {
    localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
  } catch (e) {
    console.error(e);
  }

  try {
    const payload = {
      id: "METADATA-SECTORS",
      unidade_setor: "METADATA",
      nome_ferramenta: "Configuração de Setores",
      responsavel_preenchimento: "ADMIN",
      data_registro: new Date().toISOString().split('T')[0],
      utiliza_ia: "Não",
      status_uso: "Em uso",
      data: {
        sectors: sectors
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ia_records')
      .upsert(payload);

    if (error) {
      console.error("Erro ao salvar setores no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro crítico ao salvar setores:", err);
    return false;
  }
};

function getExampleRecords(): IARecord[] {
  return [];
}
