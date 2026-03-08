import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download } from "lucide-react";

export default function ReportsPage() {
  const [byStatus, setByStatus] = useState<any[]>([]);
  const [byDept, setByDept] = useState<any[]>([]);

  const statusLabels: Record<string, string> = {
    new: "Нова", in_progress: "В процес", waiting_for_user: "Чака отговор",
    resolved: "Решена", closed: "Затворена",
  };

  const COLORS = [
    "hsl(215, 70%, 35%)", "hsl(38, 92%, 50%)", "hsl(142, 72%, 29%)",
    "hsl(0, 72%, 51%)", "hsl(215, 14%, 46%)",
  ];

  useEffect(() => {
    fetchReports();
  }, []);

  const [allTickets, setAllTickets] = useState<any[]>([]);

  const fetchReports = async () => {
    const { data: tickets } = await supabase.from("tickets").select("status, department_id, title, priority, created_at, departments(name)");
    if (!tickets) return;
    setAllTickets(tickets);

    // By status
    const statusMap: Record<string, number> = {};
    tickets.forEach((t) => {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    });
    setByStatus(Object.entries(statusMap).map(([key, value]) => ({
      name: statusLabels[key] || key,
      count: value,
    })));

    // By department
    const deptMap: Record<string, number> = {};
    tickets.forEach((t) => {
      const name = (t.departments as any)?.name || "Неизвестен";
      deptMap[name] = (deptMap[name] || 0) + 1;
    });
    setByDept(Object.entries(deptMap).map(([name, count]) => ({ name, count })));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Отчети</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Заявки по статус</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Няма данни.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 89%)" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(215, 70%, 35%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Заявки по отдел</CardTitle>
          </CardHeader>
          <CardContent>
            {byDept.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Няма данни.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byDept}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name}: ${count}`}
                    outerRadius={100}
                    dataKey="count"
                  >
                    {byDept.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
