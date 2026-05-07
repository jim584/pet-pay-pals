import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PawPrint, Calendar, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPets } from "@/lib/pets-api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DashboardHome() {
  const { user, role } = useAuth();
  const [petCount, setPetCount] = useState(0);

  useEffect(() => {
    fetchPets().then((pets) => setPetCount(pets.length)).catch(() => {});
  }, []);

  const cards = [
    { title: "My Pets", value: petCount, icon: PawPrint, color: "text-primary", link: "/dashboard/pets" },
    { title: "Appointments", value: 0, icon: Calendar, color: "text-accent", link: "#" },
    { title: "Payments", value: 0, icon: CreditCard, color: "text-primary", link: "#" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link to={card.link} key={card.title}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-display">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
