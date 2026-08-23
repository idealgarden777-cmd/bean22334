import {
  supabase
} from "./data";

import {
  config
} from "./core";

import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";

import {
  getProfileById,
  getHandleByUserId
} from "./identity";


/* ============================================================
   BEAN — SIGNATURESI
   Work Module

   Responsibilities:
   - Manage professional service listings
   - Create and read work projects
   - Submit and manage proposals
   - Accept one proposal for a project
   - Track project lifecycle
   - Expose stable work-domain contracts

   Must NOT own:
   - Payments
   - Escrow
   - Invoices
   - Messaging
   - Calls
   - Discovery ranking
   - Reviews
   - UI rendering

   Identity rule:
   Internal relationships -> immutable UUID
   Public identity       -> bean@username
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const MAX_SERVICE_TITLE_LENGTH =
  100;

const MAX_SERVICE_DESCRIPTION_LENGTH =
  2_000;

const MAX_PROJECT_TITLE_LENGTH =
  120;

const MAX_PROJECT_DESCRIPTION_LENGTH =
  5_000;

const MAX_PROPOSAL_MESSAGE_LENGTH =
  3_000;

const DEFAULT_PAGE_SIZE =
  20;

const MAX_PAGE_SIZE =
  50;


/* ============================================================
   TYPES
   ============================================================ */

export type ServiceStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived";


export type ProjectStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";


export type ProposalStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn";


export type BudgetType =
  | "fixed"
  | "hourly"
  | "negotiable";


export interface WorkService {
  id: string;

  ownerId: string;

  title: string;

  description: string;

  category: string | null;

  budgetType: BudgetType;

  priceAmount: number | null;

  currency: string | null;

  status: ServiceStatus;

  createdAt: string;

  updatedAt: string;
}


export interface WorkProject {
  id: string;

  clientId: string;

  hiredUserId: string | null;

  acceptedProposalId: string | null;

  title: string;

  description: string;

  category: string | null;

  budgetType: BudgetType;

  budgetAmount: number | null;

  currency: string | null;

  status: ProjectStatus;

  createdAt: string;

  updatedAt: string;
}


export interface WorkProposal {
  id: string;

  projectId: string;

  senderId: string;

  message: string;

  amount: number | null;

  currency: string | null;

  status: ProposalStatus;

  createdAt: string;

  updatedAt: string;
}


export interface WorkIdentitySummary {
  userId: string;

  username: string | null;

  beanId: string | null;

  displayName: string | null;
}


export interface CreateServiceInput {
  title: string;

  description: string;

  category?: string | null;

  budgetType: BudgetType;

  priceAmount?: number | null;

  currency?: string | null;
}


export interface UpdateServiceInput {
  title?: string;

  description?: string;

  category?: string | null;

  budgetType?: BudgetType;

  priceAmount?: number | null;

  currency?: string | null;

  status?: ServiceStatus;
}


export interface CreateProjectInput {
  title: string;

  description: string;

  category?: string | null;

  budgetType: BudgetType;

  budgetAmount?: number | null;

  currency?: string | null;
}


export interface SubmitProposalInput {
  projectId: string;

  message: string;

  amount?: number | null;

  currency?: string | null;
}


export interface WorkPage<T> {
  items: T[];

  offset: number;

  limit: number;

  hasMore: boolean;
}


/* ============================================================
   DATABASE ROW TYPES
   ============================================================ */

interface ServiceRow {
  id: string;

  owner_id: string;

  title: string;

  description: string;

  category: string | null;

  budget_type: BudgetType;

  price_amount: number | null;

  currency: string | null;

  status: ServiceStatus;

  created_at: string;

  updated_at: string;
}


interface ProjectRow {
  id: string;

  client_id: string;

  hired_user_id: string | null;

  accepted_proposal_id: string | null;

  title: string;

  description: string;

  category: string | null;

  budget_type: BudgetType;

  budget_amount: number | null;

  currency: string | null;

  status: ProjectStatus;

  created_at: string;

  updated_at: string;
}


interface ProposalRow {
  id: string;

  project_id: string;

  sender_id: string;

  message: string;

  amount: number | null;

  currency: string | null;

  status: ProposalStatus;

  created_at: string;

  updated_at: string;
}


/* ============================================================
   FEATURE CHECK
   ============================================================ */

function assertWorkEnabled():
  void {
  if (
    !config.featureDefaults
      .work
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "work",
      {
        message:
          "Bean Work is currently disabled."
      }
    );
  }
}


/* ============================================================
   HELPERS
   ============================================================ */

function normalizePageSize(
  value:
    number | undefined
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_PAGE_SIZE;
  }


  return Math.max(
    1,
    Math.min(
      MAX_PAGE_SIZE,
      Math.floor(value)
    )
  );
}


function normalizeOffset(
  value:
    number | undefined
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return 0;
  }


  return Math.max(
    0,
    Math.floor(value)
  );
}


function normalizeText(
  value: string,
  maxLength: number,
  fieldName: string
): string {
  const result =
    value
      .trim()
      .slice(
        0,
        maxLength
      );


  if (!result) {
    throw createError(
      "INVALID_INPUT",
      "work",
      {
        message:
          `${fieldName} cannot be empty.`
      }
    );
  }


  return result;
}


function normalizeOptionalText(
  value:
    string | null | undefined,
  maxLength:
    number
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const result =
    value
      .trim()
      .slice(
        0,
        maxLength
      );


  return result ||
    null;
}


function normalizeAmount(
  value:
    number | null | undefined
): number | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw createError(
      "INVALID_INPUT",
      "work",
      {
        message:
          "Amount must be zero or greater."
      }
    );
  }


  return Number(
    value.toFixed(2)
  );
}


function normalizeCurrency(
  value:
    string | null | undefined
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const currency =
    value
      .trim()
      .toUpperCase();


  if (!currency) {
    return null;
  }


  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "work",
      {
        message:
          "Currency must use a three-letter ISO code."
      }
    );
  }


  return currency;
}


/* ============================================================
   ROW MAPPERS
   ============================================================ */

function mapService(
  row: ServiceRow
): WorkService {
  return {
    id:
      row.id,

    ownerId:
      row.owner_id,

    title:
      row.title,

    description:
      row.description,

    category:
      row.category,

    budgetType:
      row.budget_type,

    priceAmount:
      row.price_amount,

    currency:
      row.currency,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function mapProject(
  row: ProjectRow
): WorkProject {
  return {
    id:
      row.id,

    clientId:
      row.client_id,

    hiredUserId:
      row.hired_user_id,

    acceptedProposalId:
      row.accepted_proposal_id,

    title:
      row.title,

    description:
      row.description,

    category:
      row.category,

    budgetType:
      row.budget_type,

    budgetAmount:
      row.budget_amount,

    currency:
      row.currency,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function mapProposal(
  row: ProposalRow
): WorkProposal {
  return {
    id:
      row.id,

    projectId:
      row.project_id,

    senderId:
      row.sender_id,

    message:
      row.message,

    amount:
      row.amount,

    currency:
      row.currency,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


/* ============================================================
   IDENTITY SUMMARY
   ============================================================ */

export async function getWorkIdentitySummary(
  userId: string
): Promise<WorkIdentitySummary> {
  const [
    profile,
    handle
  ] =
    await Promise.all([
      getProfileById(
        userId
      ),

      getHandleByUserId(
        userId
      )
    ]);


  return {
    userId,

    username:
      handle?.username ??
      null,

    beanId:
      handle?.beanId ??
      null,

    displayName:
      profile?.displayName ??
      null
  };
}


/* ============================================================
   CREATE SERVICE
   ============================================================ */

export async function createService(
  input:
    CreateServiceInput
): Promise<WorkService> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  const title =
    normalizeText(
      input.title,
      MAX_SERVICE_TITLE_LENGTH,
      "Service title"
    );


  const description =
    normalizeText(
      input.description,
      MAX_SERVICE_DESCRIPTION_LENGTH,
      "Service description"
    );


  const category =
    normalizeOptionalText(
      input.category,
      100
    );


  const priceAmount =
    normalizeAmount(
      input.priceAmount
    );


  const currency =
    normalizeCurrency(
      input.currency
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_services"
        )
        .insert({
          owner_id:
            account.id,

          title,

          description,

          category,

          budget_type:
            input.budgetType,

          price_amount:
            priceAmount,

          currency,

          status:
            "draft"
        })
        .select(
          `
            id,
            owner_id,
            title,
            description,
            category,
            budget_type,
            price_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ServiceRow>();


    if (error) {
      throw error;
    }


    return mapService(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "createService",

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   UPDATE OWN SERVICE
   ============================================================ */

export async function updateOwnService(
  serviceId: string,
  input:
    UpdateServiceInput
): Promise<WorkService> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  const payload:
    Record<string, unknown> = {};


  if (
    input.title !==
      undefined
  ) {
    payload.title =
      normalizeText(
        input.title,
        MAX_SERVICE_TITLE_LENGTH,
        "Service title"
      );
  }


  if (
    input.description !==
      undefined
  ) {
    payload.description =
      normalizeText(
        input.description,
        MAX_SERVICE_DESCRIPTION_LENGTH,
        "Service description"
      );
  }


  if (
    input.category !==
      undefined
  ) {
    payload.category =
      normalizeOptionalText(
        input.category,
        100
      );
  }


  if (
    input.budgetType !==
      undefined
  ) {
    payload.budget_type =
      input.budgetType;
  }


  if (
    input.priceAmount !==
      undefined
  ) {
    payload.price_amount =
      normalizeAmount(
        input.priceAmount
      );
  }


  if (
    input.currency !==
      undefined
  ) {
    payload.currency =
      normalizeCurrency(
        input.currency
      );
  }


  if (
    input.status !==
      undefined
  ) {
    payload.status =
      input.status;
  }


  if (
    Object.keys(
      payload
    ).length === 0
  ) {
    const existing =
      await getServiceById(
        serviceId
      );


    if (!existing) {
      throw createError(
        "IDENTITY_NOT_FOUND",
        "work",
        {
          message:
            "Service not found."
        }
      );
    }


    return existing;
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_services"
        )
        .update(
          payload
        )
        .eq(
          "id",
          serviceId
        )
        .eq(
          "owner_id",
          account.id
        )
        .select(
          `
            id,
            owner_id,
            title,
            description,
            category,
            budget_type,
            price_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ServiceRow>();


    if (error) {
      throw error;
    }


    return mapService(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "updateOwnService",

          serviceId,

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   GET SERVICE
   ============================================================ */

export async function getServiceById(
  serviceId: string
): Promise<WorkService | null> {
  requireAuthenticatedUser();

  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_services"
        )
        .select(
          `
            id,
            owner_id,
            title,
            description,
            category,
            budget_type,
            price_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          serviceId
        )
        .maybeSingle<ServiceRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapService(
          data
        )
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "getServiceById",

          serviceId
        }
      }
    );
  }
}


/* ============================================================
   LIST USER SERVICES
   ============================================================ */

export async function listUserServices(
  userId: string,
  input: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<WorkPage<WorkService>> {
  requireAuthenticatedUser();

  assertWorkEnabled();


  const limit =
    normalizePageSize(
      input.limit
    );


  const offset =
    normalizeOffset(
      input.offset
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_services"
        )
        .select(
          `
            id,
            owner_id,
            title,
            description,
            category,
            budget_type,
            price_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .eq(
          "owner_id",
          userId
        )
        .eq(
          "status",
          "active"
        )
        .order(
          "updated_at",
          {
            ascending:
              false
          }
        )
        .range(
          offset,
          offset + limit
        );


    if (error) {
      throw error;
    }


    const rows =
      (
        data as
          ServiceRow[] | null
      ) ?? [];


    const hasMore =
      rows.length >
        limit;


    return {
      items:
        (
          hasMore
            ? rows.slice(
                0,
                limit
              )
            : rows
        ).map(
          mapService
        ),

      offset,

      limit,

      hasMore
    };
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "listUserServices",

          userId
        }
      }
    );
  }
}


/* ============================================================
   CREATE PROJECT
   ============================================================ */

export async function createProject(
  input:
    CreateProjectInput
): Promise<WorkProject> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  const title =
    normalizeText(
      input.title,
      MAX_PROJECT_TITLE_LENGTH,
      "Project title"
    );


  const description =
    normalizeText(
      input.description,
      MAX_PROJECT_DESCRIPTION_LENGTH,
      "Project description"
    );


  const category =
    normalizeOptionalText(
      input.category,
      100
    );


  const budgetAmount =
    normalizeAmount(
      input.budgetAmount
    );


  const currency =
    normalizeCurrency(
      input.currency
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_projects"
        )
        .insert({
          client_id:
            account.id,

          hired_user_id:
            null,

          accepted_proposal_id:
            null,

          title,

          description,

          category,

          budget_type:
            input.budgetType,

          budget_amount:
            budgetAmount,

          currency,

          status:
            "open"
        })
        .select(
          `
            id,
            client_id,
            hired_user_id,
            accepted_proposal_id,
            title,
            description,
            category,
            budget_type,
            budget_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ProjectRow>();


    if (error) {
      throw error;
    }


    return mapProject(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "createProject",

          clientId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   GET PROJECT
   ============================================================ */

export async function getProjectById(
  projectId: string
): Promise<WorkProject | null> {
  requireAuthenticatedUser();

  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_projects"
        )
        .select(
          `
            id,
            client_id,
            hired_user_id,
            accepted_proposal_id,
            title,
            description,
            category,
            budget_type,
            budget_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          projectId
        )
        .maybeSingle<ProjectRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapProject(
          data
        )
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "getProjectById",

          projectId
        }
      }
    );
  }
}


/* ============================================================
   SUBMIT PROPOSAL
   ============================================================ */

export async function submitProposal(
  input:
    SubmitProposalInput
): Promise<WorkProposal> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  const project =
    await getProjectById(
      input.projectId
    );


  if (!project) {
    throw createError(
      "INVALID_INPUT",
      "work",
      {
        message:
          "Project not found."
      }
    );
  }


  if (
    project.status !==
      "open"
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "work",
      {
        message:
          "This project is not accepting proposals."
      }
    );
  }


  if (
    project.clientId ===
      account.id
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "work",
      {
        message:
          "You cannot submit a proposal to your own project."
      }
    );
  }


  const message =
    normalizeText(
      input.message,
      MAX_PROPOSAL_MESSAGE_LENGTH,
      "Proposal message"
    );


  const amount =
    normalizeAmount(
      input.amount
    );


  const currency =
    normalizeCurrency(
      input.currency
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_proposals"
        )
        .insert({
          project_id:
            input.projectId,

          sender_id:
            account.id,

          message,

          amount,

          currency,

          status:
            "pending"
        })
        .select(
          `
            id,
            project_id,
            sender_id,
            message,
            amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ProposalRow>();


    if (error) {
      if (
        error.code ===
          "23505"
      ) {
        throw createError(
          "INVALID_INPUT",
          "work",
          {
            message:
              "You already submitted a proposal to this project.",

            cause:
              error
          }
        );
      }


      throw error;
    }


    return mapProposal(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "submitProposal",

          projectId:
            input.projectId,

          senderId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   LIST PROJECT PROPOSALS
   ============================================================ */

export async function listProjectProposals(
  projectId: string
): Promise<WorkProposal[]> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  const project =
    await getProjectById(
      projectId
    );


  if (!project) {
    return [];
  }


  if (
    project.clientId !==
      account.id
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "work"
    );
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_proposals"
        )
        .select(
          `
            id,
            project_id,
            sender_id,
            message,
            amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .eq(
          "project_id",
          projectId
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (error) {
      throw error;
    }


    return (
      data as
        ProposalRow[] | null
    )?.map(
      mapProposal
    ) ?? [];
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "listProjectProposals",

          projectId
        }
      }
    );
  }
}


/* ============================================================
   ACCEPT PROPOSAL

   IMPORTANT:
   This is a multi-row state transition.

   The browser must NOT perform:
   1. proposal update
   2. project update
   3. other proposal declines

   as separate requests.

   Trusted PostgreSQL RPC does it atomically.
   ============================================================ */

export async function acceptProposal(
  proposalId: string
): Promise<WorkProject> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase.rpc(
        "bean_accept_work_proposal",
        {
          p_proposal_id:
            proposalId
        }
      );


    if (error) {
      throw error;
    }


    if (
      typeof data !==
        "string" ||
      !data
    ) {
      throw createError(
        "UNKNOWN",
        "work",
        {
          message:
            "Proposal acceptance returned no project ID."
        }
      );
    }


    const project =
      await getProjectById(
        data
      );


    if (!project) {
      throw createError(
        "UNKNOWN",
        "work",
        {
          message:
            "Accepted project could not be loaded."
        }
      );
    }


    if (
      project.clientId !==
        account.id
    ) {
      throw createError(
        "PERMISSION_DENIED",
        "work"
      );
    }


    return project;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "acceptProposal",

          proposalId,

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   WITHDRAW OWN PROPOSAL
   ============================================================ */

export async function withdrawProposal(
  proposalId: string
): Promise<WorkProposal> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_proposals"
        )
        .update({
          status:
            "withdrawn"
        })
        .eq(
          "id",
          proposalId
        )
        .eq(
          "sender_id",
          account.id
        )
        .eq(
          "status",
          "pending"
        )
        .select(
          `
            id,
            project_id,
            sender_id,
            message,
            amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ProposalRow>();


    if (error) {
      throw error;
    }


    return mapProposal(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "withdrawProposal",

          proposalId,

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   COMPLETE PROJECT

   Either final schema/RLS or trusted RPC must ensure only
   authorized project participants can perform transitions.
   ============================================================ */

export async function completeProject(
  projectId: string
): Promise<WorkProject> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_projects"
        )
        .update({
          status:
            "completed"
        })
        .eq(
          "id",
          projectId
        )
        .eq(
          "client_id",
          account.id
        )
        .eq(
          "status",
          "in_progress"
        )
        .select(
          `
            id,
            client_id,
            hired_user_id,
            accepted_proposal_id,
            title,
            description,
            category,
            budget_type,
            budget_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ProjectRow>();


    if (error) {
      throw error;
    }


    return mapProject(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "completeProject",

          projectId
        }
      }
    );
  }
}


/* ============================================================
   CANCEL OPEN PROJECT
   ============================================================ */

export async function cancelProject(
  projectId: string
): Promise<WorkProject> {
  const account =
    requireAuthenticatedUser();


  assertWorkEnabled();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_work_projects"
        )
        .update({
          status:
            "cancelled"
        })
        .eq(
          "id",
          projectId
        )
        .eq(
          "client_id",
          account.id
        )
        .eq(
          "status",
          "open"
        )
        .select(
          `
            id,
            client_id,
            hired_user_id,
            accepted_proposal_id,
            title,
            description,
            category,
            budget_type,
            budget_amount,
            currency,
            status,
            created_at,
            updated_at
          `
        )
        .single<ProjectRow>();


    if (error) {
      throw error;
    }


    return mapProject(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "work",

        context: {
          operation:
            "cancelProject",

          projectId
        }
      }
    );
  }
}
