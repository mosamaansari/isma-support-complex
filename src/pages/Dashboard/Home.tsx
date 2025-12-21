import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import PageMeta from "../../components/common/PageMeta";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard | Isma Sports Complex"
        description="Isma Sports Complex - Sales & Inventory Management Dashboard"
      />
      <div className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-6">
        <div className="col-span-12 space-y-4 sm:space-y-6 xl:col-span-6">
          <EcommerceMetrics />
          {/* <MonthlySalesChart /> */}
        </div>

        <div className="col-span-12 xl:col-span-6">
          <RecentOrders />
        </div>

        <div className="col-span-12">
          <StatisticsChart />
        </div>
      </div>
    </>
  );
}
