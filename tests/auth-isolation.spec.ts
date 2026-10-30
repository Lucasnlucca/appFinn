import { SharingAccessLevel } from '../packages/shared/src/enums';

describe('Isolamento de Dados e Governança Familiar', () => {
  // Mock simplificado do serviço de permissões para teste unitário
  class MockPermissionsService {
    private permissions = new Map<string, SharingAccessLevel>();

    private makeKey(ownerId: string, recipientId: string, resourceType: string, resourceId: string) {
      return `${ownerId}:${recipientId}:${resourceType}:${resourceId}`;
    }

    setSharingPermission(ownerId: string, recipientId: string, resourceType: string, resourceId: string, level: SharingAccessLevel) {
      if (ownerId === recipientId) {
        throw new Error('Não é possível definir permissões de compartilhamento para você mesmo');
      }
      this.permissions.set(this.makeKey(ownerId, recipientId, resourceType, resourceId), level);
    }

    canAccessResource(requestingUserId: string, ownerUserId: string, resourceType: string, resourceId: string): boolean {
      if (requestingUserId === ownerUserId) {
        return true; // O próprio titular sempre tem acesso
      }
      const level = this.permissions.get(this.makeKey(ownerUserId, requestingUserId, resourceType, resourceId));
      return level !== undefined && level !== SharingAccessLevel.NONE;
    }
  }

  let service: MockPermissionsService;
  const userA_Id = 'user-marido-uuid';
  const userB_Id = 'user-esposa-uuid';
  const accountId = 'conta-corrente-itau-uuid';

  beforeEach(() => {
    service = new MockPermissionsService();
  });

  it('deve permitir que o titular acesse sua própria conta sem restrições', () => {
    const canAccess = service.canAccessResource(userA_Id, userA_Id, 'ACCOUNT', accountId);
    expect(canAccess).toBe(true);
  });

  it('NUNCA deve permitir que o cônjuge veja a conta do parceiro por padrão (Isolamento por Design)', () => {
    // Ambos pertencem à mesma família, mas nenhuma permissão foi concedida
    const canAccess = service.canAccessResource(userB_Id, userA_Id, 'ACCOUNT', accountId);
    expect(canAccess).toBe(false);
  });

  it('deve permitir acesso ao cônjuge SOMENTE quando houver autorização expressa (VIEW_ONLY ou VIEW_AND_EDIT)', () => {
    // Marido autoriza visualização para a esposa
    service.setSharingPermission(userA_Id, userB_Id, 'ACCOUNT', accountId, SharingAccessLevel.VIEW_ONLY);

    const canAccess = service.canAccessResource(userB_Id, userA_Id, 'ACCOUNT', accountId);
    expect(canAccess).toBe(true);
  });

  it('deve bloquear imediatamente o acesso caso a permissão seja revogada para NONE', () => {
    // Autoriza
    service.setSharingPermission(userA_Id, userB_Id, 'ACCOUNT', accountId, SharingAccessLevel.VIEW_ONLY);
    expect(service.canAccessResource(userB_Id, userA_Id, 'ACCOUNT', accountId)).toBe(true);

    // Revoga
    service.setSharingPermission(userA_Id, userB_Id, 'ACCOUNT', accountId, SharingAccessLevel.NONE);
    expect(service.canAccessResource(userB_Id, userA_Id, 'ACCOUNT', accountId)).toBe(false);
  });
});

