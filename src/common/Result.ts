type Result<T> = {
    type: 'success' | 'error';
    data?: T;
    error?: {
        message: string;
        code?: string | number;
    };
};
