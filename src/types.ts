export type WorkerStatus = 'Ativo' | 'Afastado' | 'Inativo';
export type Worker = {
  id: string;
  name: string;
  registration: string;
  shift: string;
  group: string;
  role: string;
  status: WorkerStatus;
  teamCode?: string;
  teamName?: string;
  leader?: string;
  validFrom?: string;
  notes?: string;
  updatedAt?: string;
};
export type View = 'overview' | 'team' | 'days-off' | 'management';
