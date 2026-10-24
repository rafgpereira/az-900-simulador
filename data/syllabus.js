/*
 * Estrutura do exame AZ-900 — "Habilidades medidas a partir de 20 de julho de 2026"
 * Fonte: https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900
 *
 * Cada eixo (domínio) tem subtópicos; cada subtópico tem os conteúdos (habilidades)
 * específicos. As questões são categorizadas no nível da habilidade (ex.: "1.1.2").
 */
window.AZ = window.AZ || {};

AZ.EXAM = {
  code: 'AZ-900',
  name: 'Microsoft Azure Fundamentals',
  skillsDate: '20/07/2026',
  passing: 700,
  minutes: 45,
  questionRange: [40, 60]
};

const LEARN = 'https://learn.microsoft.com/pt-br/';

AZ.DOMAINS = [
  {
    id: 1,
    name: 'Descrever os conceitos da nuvem',
    short: 'Conceitos de nuvem',
    weight: [25, 30],
    subtopics: [
      {
        id: '1.1',
        name: 'Descrever a computação em nuvem',
        learn: LEARN + 'training/modules/describe-cloud-compute/',
        skills: [
          ['1.1.1', 'Definir a computação em nuvem'],
          ['1.1.2', 'Descrever o modelo de responsabilidade compartilhada', LEARN + 'azure/security/fundamentals/shared-responsibility'],
          ['1.1.3', 'Definir os modelos de nuvem: público, privado e híbrido'],
          ['1.1.4', 'Identificar os casos de uso apropriados para cada modelo de nuvem'],
          ['1.1.5', 'Descrever o modelo baseado em consumo'],
          ['1.1.6', 'Comparar os modelos de preços de nuvem', 'https://azure.microsoft.com/pt-br/pricing/'],
          ['1.1.7', 'Descrever a computação sem servidor', LEARN + 'azure/azure-functions/functions-overview']
        ]
      },
      {
        id: '1.2',
        name: 'Descrever os benefícios do uso de serviços de nuvem',
        learn: LEARN + 'training/modules/describe-benefits-use-cloud-services/',
        skills: [
          ['1.2.1', 'Benefícios da alta disponibilidade e da escalabilidade'],
          ['1.2.2', 'Benefícios da confiabilidade e da previsibilidade'],
          ['1.2.3', 'Benefícios da segurança e da governança'],
          ['1.2.4', 'Benefícios da capacidade de gerenciamento']
        ]
      },
      {
        id: '1.3',
        name: 'Descrever os tipos de serviço de nuvem',
        learn: LEARN + 'training/modules/describe-cloud-service-types/',
        skills: [
          ['1.3.1', 'Descrever a IaaS (infraestrutura como serviço)'],
          ['1.3.2', 'Descrever a PaaS (plataforma como serviço)'],
          ['1.3.3', 'Descrever o SaaS (software como serviço)'],
          ['1.3.4', 'Identificar casos de uso para IaaS, PaaS e SaaS']
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'Descrever a arquitetura e os serviços do Azure',
    short: 'Arquitetura e serviços',
    weight: [35, 40],
    subtopics: [
      {
        id: '2.1',
        name: 'Descrever os principais componentes arquitetônicos do Azure',
        learn: LEARN + 'training/modules/describe-core-architectural-components-of-azure/',
        skills: [
          ['2.1.1', 'Regiões, pares de regiões e regiões soberanas', LEARN + 'azure/reliability/regions-overview'],
          ['2.1.2', 'Zonas de disponibilidade', LEARN + 'azure/reliability/availability-zones-overview'],
          ['2.1.3', 'Datacenters do Azure'],
          ['2.1.4', 'Recursos e grupos de recursos', LEARN + 'azure/azure-resource-manager/management/manage-resource-groups-portal'],
          ['2.1.5', 'Assinaturas'],
          ['2.1.6', 'Grupos de gerenciamento', LEARN + 'azure/governance/management-groups/overview'],
          ['2.1.7', 'Hierarquia: grupos de gerenciamento, assinaturas, grupos de recursos']
        ]
      },
      {
        id: '2.2',
        name: 'Descrever os serviços de computação e rede do Azure',
        learn: LEARN + 'training/modules/describe-azure-compute-networking-services/',
        skills: [
          ['2.2.1', 'Comparar tipos de computação: contêineres, máquinas virtuais e funções'],
          ['2.2.2', 'Opções de VM: VMs, Conjuntos de Dimensionamento, conjuntos de disponibilidade e Área de Trabalho Virtual', LEARN + 'azure/virtual-machine-scale-sets/overview'],
          ['2.2.3', 'Recursos necessários para máquinas virtuais', LEARN + 'azure/virtual-machines/overview'],
          ['2.2.4', 'Opções de hospedagem de aplicativos: Aplicativos Web, contêineres e VMs', LEARN + 'azure/app-service/overview'],
          ['2.2.5', 'Rede virtual: VNets, sub-redes, emparelhamento, DNS, Gateway de VPN e ExpressRoute', LEARN + 'azure/virtual-network/virtual-networks-overview'],
          ['2.2.6', 'Endpoints públicos e privados', LEARN + 'azure/private-link/private-endpoint-overview']
        ]
      },
      {
        id: '2.3',
        name: 'Descrever os serviços do armazenamento do Azure',
        learn: LEARN + 'training/modules/describe-azure-storage-services/',
        skills: [
          ['2.3.1', 'Comparar os serviços do Armazenamento do Azure', LEARN + 'azure/storage/common/storage-introduction'],
          ['2.3.2', 'Níveis (camadas) de armazenamento', LEARN + 'azure/storage/blobs/access-tiers-overview'],
          ['2.3.3', 'Opções de redundância', LEARN + 'azure/storage/common/storage-redundancy'],
          ['2.3.4', 'Opções de conta de armazenamento e tipos de armazenamento', LEARN + 'azure/storage/common/storage-account-overview'],
          ['2.3.5', 'Mover arquivos: AzCopy, Gerenciador de Armazenamento e Sincronização de Arquivos', LEARN + 'azure/storage/file-sync/file-sync-introduction'],
          ['2.3.6', 'Migração: Migrações para Azure e Azure Data Box', LEARN + 'azure/migrate/migrate-services-overview']
        ]
      },
      {
        id: '2.4',
        name: 'Descrever a identidade, o acesso e a segurança do Azure',
        learn: LEARN + 'training/modules/describe-azure-identity-access-security/',
        skills: [
          ['2.4.1', 'Serviços de diretório: Microsoft Entra ID e Microsoft Entra Domain Services', LEARN + 'entra/fundamentals/whatis'],
          ['2.4.2', 'Métodos de autenticação: SSO, MFA e sem senha', LEARN + 'entra/identity/authentication/concept-authentication-methods'],
          ['2.4.3', 'Identidades externas', LEARN + 'entra/external-id/external-identities-overview'],
          ['2.4.4', 'Acesso Condicional do Microsoft Entra', LEARN + 'entra/identity/conditional-access/overview'],
          ['2.4.5', 'Controle de acesso baseado em função (RBAC) do Azure', LEARN + 'azure/role-based-access-control/overview'],
          ['2.4.6', 'Conceito de Confiança Zero (Zero Trust)', LEARN + 'security/zero-trust/zero-trust-overview'],
          ['2.4.7', 'Modelo de defesa em profundidade'],
          ['2.4.8', 'Microsoft Defender para Nuvem', LEARN + 'azure/defender-for-cloud/defender-for-cloud-introduction']
        ]
      }
    ]
  },
  {
    id: 3,
    name: 'Descrever o gerenciamento e a governança do Azure',
    short: 'Gerenciamento e governança',
    weight: [30, 35],
    subtopics: [
      {
        id: '3.1',
        name: 'Descrever o gerenciamento de custos no Azure',
        learn: LEARN + 'training/modules/describe-cost-management-azure/',
        skills: [
          ['3.1.1', 'Fatores que podem afetar os custos no Azure'],
          ['3.1.2', 'Calculadora de preços', 'https://azure.microsoft.com/pt-br/pricing/calculator/'],
          ['3.1.3', 'Funcionalidades de gerenciamento de custos', LEARN + 'azure/cost-management-billing/costs/overview-cost-management'],
          ['3.1.4', 'Finalidade das marcas (tags)', LEARN + 'azure/azure-resource-manager/management/tag-resources']
        ]
      },
      {
        id: '3.2',
        name: 'Descrever recursos e ferramentas de governança e conformidade',
        learn: LEARN + 'training/modules/describe-features-tools-azure-for-governance-compliance/',
        skills: [
          ['3.2.1', 'Finalidade do Microsoft Purview', LEARN + 'purview/purview'],
          ['3.2.2', 'Finalidade do Azure Policy', LEARN + 'azure/governance/policy/overview'],
          ['3.2.3', 'Finalidade dos bloqueios de recursos', LEARN + 'azure/azure-resource-manager/management/lock-resources']
        ]
      },
      {
        id: '3.3',
        name: 'Descrever recursos e ferramentas para gerenciar e implantar recursos',
        learn: LEARN + 'training/modules/describe-features-tools-manage-deploy-azure-resources/',
        skills: [
          ['3.3.1', 'Portal do Azure', LEARN + 'azure/azure-portal/azure-portal-overview'],
          ['3.3.2', 'Azure Cloud Shell, CLI do Azure e Azure PowerShell', LEARN + 'azure/cloud-shell/overview'],
          ['3.3.3', 'Finalidade do Azure Arc', LEARN + 'azure/azure-arc/overview'],
          ['3.3.4', 'Infraestrutura como código (IaC)'],
          ['3.3.5', 'Azure Resource Manager (ARM) e modelos do ARM', LEARN + 'azure/azure-resource-manager/templates/overview']
        ]
      },
      {
        id: '3.4',
        name: 'Descrever as ferramentas de monitoramento no Azure',
        learn: LEARN + 'training/modules/describe-monitoring-tools-azure/',
        skills: [
          ['3.4.1', 'Finalidade do Assistente do Azure (Azure Advisor)', LEARN + 'azure/advisor/advisor-overview'],
          ['3.4.2', 'Integridade do Serviço do Azure', LEARN + 'azure/service-health/overview'],
          ['3.4.3', 'Azure Monitor: Log Analytics, alertas e Application Insights', LEARN + 'azure/azure-monitor/overview']
        ]
      }
    ]
  }
];

/*
 * Formato compacto das questões (o tipo é inferido pelos campos):
 *   s  : nº da habilidade dentro do subtópico (1 => "1.1.1")
 *   d  : dificuldade 1 (fácil) | 2 (média) | 3 (difícil)
 *   q  : enunciado. Em listas suspensas, use {0}, {1}... para as lacunas
 *   o,a: opções e índice correto (múltipla escolha) ou array de índices (múltipla seleção)
 *   ns : 1 = não embaralhar as opções (ex.: "Sim"/"Não")
 *   st : [[afirmação, true|false], ...]                    -> Sim/Não
 *   bl : [{o:[...], a:idx}, ...]                           -> lista suspensa
 *   ch, it: valores e [[descrição, idxValor], ...]         -> arrastar e soltar
 *   e  : explicação exibida na correção
 */
AZ._raw = [];
AZ.add = function (subId, list) { AZ._raw.push([subId, list]); };
