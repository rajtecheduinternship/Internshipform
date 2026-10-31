'use client';
import { useCopy } from '@/components/help/i18n';
import type { AttendanceRecord } from '@/lib/attendance';
export default function AttendanceStatus({ record }: { record?: AttendanceRecord }) {
  const t=useCopy();
  return <p className="font-semibold" role="status">{record?.status==='present' ? t('Present · Approved by admin','उपस्थित · एडमिन द्वारा स्वीकृत') : record?.request_pending ? (record.status==='absent' ? t('Marked absent · Attendance review requested','अनुपस्थित दर्ज · उपस्थिति समीक्षा का अनुरोध किया') : t('Attendance request pending review','उपस्थिति अनुरोध की समीक्षा बाकी है')) : record?.status==='absent' ? t('Marked absent by admin','एडमिन ने अनुपस्थित दर्ज किया') : record?.join_clicked_at ? t('Join link opened · Awaiting admin approval','जुड़ने का लिंक खोला · एडमिन की मंज़ूरी बाकी है') : t('Attendance not marked','उपस्थिति दर्ज नहीं है')}</p>;
}
