import { useStore } from '../../store'

const ROLES = ['Admin', 'Dispatcher', 'Accounts', 'Driver Manager']

export function Step1Team() {
  const { teamMembers, addTeamMember, updateTeamMember } = useStore()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">👥 Your Team</h2>
      <p className="text-gray-500 text-sm">Add the people who'll be using Deliver Different. They'll each get a personalized invitation.</p>
      <div className="grid grid-cols-2 gap-4">
        {teamMembers.map((m, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cyan/15 flex items-center justify-center text-lg font-bold text-cyan">
                {m.name ? m.name[0] : '?'}
              </div>
              <div className="flex-1">
                <input value={m.name} onChange={(e) => updateTeamMember(i, 'name', e.target.value)} className="block w-full text-sm font-semibold text-navy focus:outline-none" placeholder="Name" />
                <input value={m.email} onChange={(e) => updateTeamMember(i, 'email', e.target.value)} className="block w-full text-xs text-gray-400 focus:outline-none mt-0.5" placeholder="Email" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <select value={m.role} onChange={(e) => updateTeamMember(i, 'role', e.target.value)} className="text-xs bg-lgrey rounded-full px-3 py-1.5 border-0 focus:outline-none font-medium">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <button className="text-xs font-semibold text-cyan hover:text-cyan-dark transition px-3 py-1.5 rounded-full bg-cyan/10">✉ Invite</button>
            </div>
          </div>
        ))}
        <div onClick={addTeamMember} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-cyan transition card-hover min-h-[140px]">
          <div className="text-center">
            <div className="text-3xl text-gray-300 mb-2">+</div>
            <div className="text-sm text-gray-400 font-medium">Add Team Member</div>
          </div>
        </div>
      </div>
    </div>
  )
}
