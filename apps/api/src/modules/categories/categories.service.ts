import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from '@finn-ai/shared';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(householdId?: string | null) {
    return this.prisma.transactionCategory.findMany({
      where: householdId
        ? { OR: [{ householdId }, { householdId: null }] }
        : { householdId: null },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto, householdId?: string | null) {
    return this.prisma.transactionCategory.create({
      data: {
        name: dto.name.trim(),
        icon: dto.icon || 'tag',
        colorHex: dto.colorHex || '#10b981',
        parentId: dto.parentId || null,
        householdId: householdId || null,
      },
    });
  }

  /**
   * Seed automático de categorias essenciais para a família
   */
  async seedDefaultCategories(householdId: string) {
    const defaultCategories = [
      { name: 'Alimentação & Supermercado', icon: 'shopping-cart', colorHex: '#f59e0b' },
      { name: 'Moradia & Contas Fixas', icon: 'home', colorHex: '#3b82f6' },
      { name: 'Transporte & Combustível', icon: 'car', colorHex: '#6366f1' },
      { name: 'Saúde & Farmácia', icon: 'heart-pulse', colorHex: '#ef4444' },
      { name: 'Lazer & Restaurantes', icon: 'utensils', colorHex: '#ec4899' },
      { name: 'Educação & Cursos', icon: 'graduation-cap', colorHex: '#8b5cf6' },
      { name: 'Salário & Renda Familiar', icon: 'briefcase', colorHex: '#10b981' },
      { name: 'Investimentos & Reserva', icon: 'trending-up', colorHex: '#059669' },
    ];

    for (const cat of defaultCategories) {
      await this.prisma.transactionCategory.create({
        data: {
          name: cat.name,
          icon: cat.icon,
          colorHex: cat.colorHex,
          householdId,
        },
      });
    }
  }
}

