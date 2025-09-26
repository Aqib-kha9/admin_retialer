"use client";
import { useRouter } from 'next/navigation';
import ProductDashboardPage from '../../components/ProductDashboardPage';

export default function AdminDashboardPage() {
  return <ProductDashboardPage userType="admin" />;
} 