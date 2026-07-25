export type Status = 'backlog'|'scheduled'|'in_progress'|'testing'|'done'|'blocked'|'paused'
export type Priority = 'P0'|'P1'|'P2'
export type Kind = 'feature'|'bug'

export interface Member {
  id:number;
  name:string;
  week_capacity:number;
  modules:string;
  active:boolean
}

export interface Requirement {
  id:number;
  title:string;
  status:Status;
  priority:Priority;
  kind:Kind;
  assignee:number|null;
  assignee_name?:string;
  module:string;
  progress:number;
  est_effort:number;
  actual_effort:number;
  planned_start:string|null;
  planned_end:string|null;
  note:string;
  parent: number | null;
  version:number|null;
  version_name?:string;
  blocked_by:number[];
  last_status_change_at:string|null;
  created_at:string;
}

export interface Version {
  id:number;
  name:string;
  phase:string;
  dev_start_date:string|null;
  integration_date:string|null;
  freeze_date:string|null;
  test_date:string|null;
  release_date:string|null;
  note:string;
  current_phase:string;
  created_at:string;
  updated_at:string;
}

export interface VersionMergePoint {
  id:number;
  version:number;
  date:string|null;
  note:string;
  created_at:string;
}

export interface Milestone {
  id:number;
  requirement:number;
  title:string;
  date:string;
  note:string;
  created_at:string;
}

export interface TimeEntry {
  id:number;
  requirement:number;
  member:number|null;
  hours:number;
  date:string|null;
  note:string;
  created_at:string;
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

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface Draft {
  title: string
  status?: string
  priority?: string
  module?: string
  est_effort?: number
  assignee?: number | null
  parent?: number | null
}

export interface DraftResult {
  parent: { title: string }
  children: Array<{ title: string; type?: string; analysis?: string }>
}

export interface MemberSnapshot {
  date: string
  member_id: number
  member: string
  remaining_effort: number
}

export interface AIAction {
  type: string
  match?: Record<string, any>
  fields?: Record<string, any>
  params?: Record<string, any>
  description?: string
}

export interface FlowMetrics {
  throughput: { week: string; count: number }[]
  cycletime: { id: number; title: string; hours: number }[]
  cfd: Array<Record<string, number | string>>
}
