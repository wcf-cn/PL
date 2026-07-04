import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, type Member, type Sprint, type Requirement } from '../types'

export default function Schedule() {
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const [membersData, sprintsData, reqsData] = await Promise.all([
        api.members.list(),
        api.sprints.list(),
        api.requirements.list()
      ])
      setMembers(membersData)
      setSprints(sprintsData)
      setRequirements(reqsData)

      // Default to active sprint
      const activeSprint = sprintsData.find(s => s.is_active)
      if (activeSprint) {
        setSelectedSprint(activeSprint.id)
      }
    }
    loadData()
  }, [])

  const activeMembers = members.filter(m => m.active)
  const sprintReqs = requirements.filter(r => r.assigned_sprint === selectedSprint)

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">排期</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">选择迭代</label>
        <select
          value={selectedSprint || ''}
          onChange={e => setSelectedSprint(e.target.value ? Number(e.target.value) : null)}
          className="px-2 py-1 border rounded"
        >
          <option value="">未选择</option>
          {sprints.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} {s.is_active ? '(当前)' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedSprint && (
        <div className="space-y-4">
          {activeMembers.map(member => {
            const memberReqs = sprintReqs.filter(r => r.assignee === member.id)
            if (memberReqs.length === 0) return null

            return (
              <div key={member.id} className="border rounded p-3">
                <h3 className="font-bold mb-2">{member.name}</h3>
                <div className="space-y-2">
                  {memberReqs.map(req => (
                    <div key={req.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                      <span className="flex-1 font-medium">{req.title}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {STATUS_LABEL[req.status]}
                      </span>
                      <span className="text-gray-500">
                        预计 {req.est_effort}h / 已投 {req.actual_effort}h
                      </span>
                      {(req.planned_start || req.planned_end) && (
                        <span className="text-gray-400 text-xs">
                          {req.planned_start || '?'} ~ {req.planned_end || '?'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {activeMembers.every(m => sprintReqs.filter(r => r.assignee === m.id).length === 0) && (
            <div className="text-gray-400 text-sm">当前迭代暂无分配的需求</div>
          )}
        </div>
      )}

      {!selectedSprint && (
        <div className="text-gray-400 text-sm">请选择一个迭代查看排期</div>
      )}
    </div>
  )
}