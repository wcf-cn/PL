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
