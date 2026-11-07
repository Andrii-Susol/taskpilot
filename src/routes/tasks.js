// Task routes. Each handler receives ({ req, params, query, body }) and
// returns { status, body }.
import { STATUSES } from '../store.js';

export function registerTaskRoutes(router, store) {
  router.add('GET', '/health', () => ({
    status: 200,
    body: { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
  }));

  router.add('GET', '/tasks', ({ query }) => {
    const status = query.get('status');
    if (status && !STATUSES.includes(status)) {
      return { status: 400, body: { error: `status must be one of: ${STATUSES.join(', ')}` } };
    }
    return { status: 200, body: store.list({ status: status ?? undefined }) };
  });

  router.add('POST', '/tasks', ({ body }) => ({ status: 201, body: store.create(body) }));

  router.add('GET', '/tasks/stats', () => {
    const tasks = store.list();
    const byStatus = {
      todo: 0,
      'in-progress': 0,
      done: 0,
    };
    tasks.forEach((task) => {
      byStatus[task.status]++;
    });
    return {
      status: 200,
      body: {
        total: tasks.length,
        byStatus,
      },
    };
  });

  router.add('GET', '/tasks/:id', ({ params }) => {
    const task = store.get(params.id);
    return task ? { status: 200, body: task } : { status: 404, body: { error: 'Task not found' } };
  });

  router.add('PATCH', '/tasks/:id', ({ params, body }) => {
    const task = store.update(params.id, body);
    return task ? { status: 200, body: task } : { status: 404, body: { error: 'Task not found' } };
  });

  router.add('DELETE', '/tasks/:id', ({ params }) =>
    store.remove(params.id) ? { status: 204, body: null } : { status: 404, body: { error: 'Task not found' } },
  );
}
