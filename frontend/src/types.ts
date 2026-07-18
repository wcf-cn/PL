export type Status = 'backlog'|'scheduled'|'in_progress'|'testing'|'done'|'blocked'|'paused'
export type Priority = 'P0'|'P1'|'P2'

export interface Member {
  id:number;
  name:string;
  week_capacity:number;
  modules:string;
  active:boolean
}

export interface Sprint {
  id:number;
  name:string;
  start_date:string;
  end_date:string;
  is_active:boolean;
  weeks:number
}

export interface Requirement {
  id:number;
  title:string;
  status:Status;
  priority:Priority;
  assignee:number|null;
  assignee_name?:string;
  module:string;
  progress:number;
  est_effort:number;
  actual_effort:number;
  assigned_sprint:number|null;
  sprint_name?:string;
  planned_start:string|null;
  planned_end:string|null;
  note:string;
  parent: number | null;
}

export interface CapacityRow {
  member_id:number;
  member:string;
  capacity:number;
  load:number;
  utilization:number
}

export interface Milestone {
  id:number;
  requirement:number;
  title:string;
  date:string;
  note:string;
  created_at:string;
}

export interface BurndownSnapshot {
  date:string;
  remaining_effort:number;
}

export interface BurndownSprint {
  id:number;
  name:string;
  start_date:string;
  end_date:string;
}

export interface BurndownData {
  sprint:BurndownSprint;
  total_effort:number;
  snapshots:BurndownSnapshot[];
}

export const STATUS_LABEL: Record<Status,string> = {
  backlog:'待评审',
  scheduled:'排期中',
  in_progress:'开发中',
  testing:'测试中',
  done:'已上线',
  blocked:'已阻塞',
  paused:'暂停'
}

export const STATUS_ORDER: Status[] = ['backlog','scheduled','in_progress','testing','done','blocked','paused']

export const calcProgress = (est: number, actual: number) => est > 0 ? Math.round(actual / est * 100) : 0

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface Draft {
  title: string
  status?: string
  priority?: string
  module?: string
  est_effort?: number
  assigned_sprint?: number | null
  assignee?: number | null
  parent?: number | null
}

export interface DraftResult {
  parent: { title: string }
  children: Array<{ title: string; type?: string; analysis?: string }>
}
