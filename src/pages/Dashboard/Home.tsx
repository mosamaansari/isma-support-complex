import { useEffect, useState } from "react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import PageMeta from "../../components/common/PageMeta";
import api from "../../services/api";
import { DashboardStats } from "../../types";
import { useData } from "../../context/DataContext";


export default function Home() {
  const { currentUser } = useData();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (error: any) {
        console.error("Error loading dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [currentUser]);

  return (
    <>
      <PageMeta
        title="Dashboard | Isma Sports Complex"
        description="Isma Sports Complex - Sales & Inventory Management Dashboard"
      />
      <div className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-6">
        <div className="col-span-12">
          <EcommerceMetrics stats={stats} loading={loading} />
        </div>

        <div className="col-span-12">
          <StatisticsChart stats={stats} loading={loading} />
        </div>

        <div className="col-span-12">
          <RecentOrders stats={stats} loading={loading} />
        </div>
      </div>
    </>
  );
}
