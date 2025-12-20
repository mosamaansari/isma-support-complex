import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { UserRole } from "../../types";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Pagination from "../../components/ui/Pagination";
import PageSizeSelector from "../../components/ui/PageSizeSelector";
import { Modal } from "../../components/ui/modal";
import { PencilIcon, TrashBinIcon } from "../../icons";

export default function UserList() {
  const { users, usersPagination, deleteUser, currentUser, loading, error, refreshUsers } = useData();
  const { showError } = useAlert();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const usersLoadedRef = useRef(false);

  // Refresh users on mount if empty (only once)
  useEffect(() => {
    if (!usersLoadedRef.current) {
      usersLoadedRef.current = true;
      if (!loading && (!users || users.length === 0) && currentUser) {
        refreshUsers(usersPagination?.page || 1, usersPagination?.pageSize || 10).catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (page: number) => {
    refreshUsers(page, usersPagination?.pageSize || 10);
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshUsers(1, pageSize);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  const filteredUsers = (users || []).filter((user) => {
    if (!user || !user.name || !user.username) return false;
    return (
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDeleteClick = (id: string) => {
    if (id === currentUser?.id) {
      showError("You cannot delete your own account");
      return;
    }
    setUserToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(userToDelete);
      try {
      await deleteUser(userToDelete);
      await refreshUsers(usersPagination?.page || 1, usersPagination?.pageSize || 10);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      } catch (err) {
      showError("Failed to delete user. Please try again.");
        console.error("Delete error:", err);
      } finally {
        setIsDeleting(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <Button onClick={() => refreshUsers(usersPagination?.page || 1, usersPagination?.pageSize || 10)} size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "cashier":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "warehouse_manager":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Access denied. Admin or SuperAdmin privileges required.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="User Management | Isma Sports Complex"
        description="Manage users and access"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            User Management
          </h1>
          <Link to="/users/add">
            <Button size="sm">Add User</Button>
          </Link>
        </div>

        <div className="mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name or username..."
            className="max-w-md"
          />
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Role
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Permissions
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Created
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  {users.length === 0
                    ? "No users available. Add your first user!"
                    : "No users match your search criteria"}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="p-4 font-medium text-gray-800 dark:text-white max-w-[200px]">
                    <div className="line-clamp-3">
                      {user.name}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {user.username}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {user.email || "-"}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <span className="text-xs">
                      {user.permissions && user.permissions.length > 0
                        ? `${user.permissions.length} permission(s)`
                        : "Default permissions"}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <span className="text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 flex-nowrap">
                      <Link to={`/users/edit/${user.id}`}>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20 flex-shrink-0">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </Link>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteClick(user.id)}
                          disabled={isDeleting === user.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <TrashBinIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-6 flex flex-col gap-4 bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <PageSizeSelector
            pageSize={usersPagination?.pageSize || 10}
            onPageSizeChange={handlePageSizeChange}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((usersPagination?.page || 1) - 1) * (usersPagination?.pageSize || 10) + 1} to{" "}
            {Math.min((usersPagination?.page || 1) * (usersPagination?.pageSize || 10), usersPagination?.total || 0)} of{" "}
            {usersPagination?.total || 0} users
          </span>
        </div>
        <div className="flex justify-center">
          <Pagination
            currentPage={usersPagination?.page || 1}
            totalPages={usersPagination?.totalPages || 1}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full dark:bg-red-900/20">
              <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Delete User
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this user? This will permanently remove the user account and all associated data.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeleting !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmDelete}
              disabled={isDeleting !== null}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

