import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { CALL_STATUS } from '../../shared/model';
import { brl, openBills } from '../../shared/orders';
import { Confirm } from '../../shared/ui/Modal';

/**
 * Fechar a conta = liberar a mesa: encerra os pedidos da mesa e conclui as
 * chamadas que ainda estão abertas dela (ex.: "pediu a conta").
 * Usado em Pedidos e no Painel.
 */
export function useCloseBill() {
  const { rid, user, myName, orders, calls, run } = useAdmin();
  const [bill, setBill] = useState(null);
  const bills = useMemo(() => openBills(orders.data || []), [orders.data]);
  const billOf = (tableId) => bills.find((b) => b.tableId === tableId) || null;

  const modal = bill && (
    <Confirm
      title={`Fechar a conta da mesa ${bill.tableNumber}?`}
      message={`Total de ${brl(bill.total)} em ${bill.orders.length} ${bill.orders.length === 1 ? 'pedido' : 'pedidos'}. Os pedidos saem das contas abertas, os avisos da mesa são concluídos e a mesa fica livre para os próximos clientes.`}
      confirmLabel="Fechar conta e liberar mesa"
      onClose={() => setBill(null)}
      onConfirm={() => {
        const b = bill;
        const callIds = (calls.data || [])
          .filter((c) => c.tableId === b.tableId && (c.status === CALL_STATUS.PENDING || c.status === CALL_STATUS.VIEWED))
          .map((c) => c.id);
        setBill(null);
        run(
          () => api.closeBill(rid, b.orders.map((o) => o.id), callIds, { uid: user.uid, name: myName }, b.tableId),
          `Conta da mesa ${b.tableNumber} fechada. Mesa liberada.`,
        ).catch(() => {});
      }}
    />
  );
  return { bills, billOf, ask: setBill, modal };
}
