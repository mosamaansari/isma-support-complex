import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SuperAdminSignInForm from "../../components/auth/SuperAdminSignInForm";

export default function SuperAdminSignIn() {
  return (
    <>
      <PageMeta
        title="Super Admin Login | Isma Sports Complex"
        description="Super Admin login for Isma Sports Complex"
      />
      <AuthLayout>
        <SuperAdminSignInForm />
      </AuthLayout>
    </>
  );
}

