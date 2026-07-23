-- ============================================================================
-- Cada empresa puede corregir los gastos que cargó.
--
-- El admin ya podía todo (su policy es aparte). Esto habilita a un usuario de
-- empresa a editar y anular los gastos que están a nombre de su empresa, en
-- las obras donde participa.
--
-- El WITH CHECK repite la condición a propósito: sin él, alguien podría editar
-- un gasto propio y reasignárselo a otra empresa, alterando el balance.
-- ============================================================================

create policy gastos_update_empresa on gastos for update to authenticated
  using (
    empresa_pagadora_id = auth_empresa_id()
    and puede_ver_obra(obra_id)
  )
  with check (
    empresa_pagadora_id = auth_empresa_id()
    and puede_ver_obra(obra_id)
  );
