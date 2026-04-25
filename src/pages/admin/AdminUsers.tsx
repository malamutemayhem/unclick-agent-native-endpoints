import { Users } from "lucide-react";

export default function AdminUsers() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-[#E2B93B]" />
        <h1 className="text-2xl font-semibold text-white">User Management</h1>
        <span className="rounded-full border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#E2B93B]">
          Coming soon
        </span>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <p className="text-sm leading-relaxed text-[#ccc]">
          See every person who has signed up for UnClick. From here you will be able to step
          into a user's account to help them, or revoke their keys if something goes wrong.
        </p>
      </div>
    </div>
  );
}
